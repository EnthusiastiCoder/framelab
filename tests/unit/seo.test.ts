// U24 seo: reads the built site (dist/**/index.html, dist/sitemap*.xml, dist/robots.txt). Run `npm run build` first.
// Contract:
//   - every page has exactly one <link rel="canonical"> with an absolute https URL whose path is the page route
//     (a trailing slash is allowed);
//   - every page has a non-empty <title> and <meta name="description">, both unique across pages;
//   - every <script type="application/ld+json"> parses; its graph (a single object, an array or {"@graph": [...]})
//     is checked by @type;
//   - every tool page (PLAN_TOOL_SLUGS) has SoftwareApplication with offers.price 0, and FAQPage with 4 to 6 Questions
//     (the plan's "4 to 6 FAQs"); any other page with FAQs (an element id="faq") also has FAQPage;
//   - the sitemap lists every tool slug and /no-watermark-video-editor; robots.txt points at the sitemap.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, attr, decodeEntities, distPages, readDist, requireDist, tags, type DistPage } from '../helpers/dist';
import { PLAN_TOOL_SLUGS } from '../helpers/pages';

type Json = Record<string, unknown>;

function title(html: string): string {
  return decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1].trim() ?? '');
}

function description(html: string): string {
  const tag = tags(html, 'meta').find((t) => attr(t, 'name')?.toLowerCase() === 'description');
  return decodeEntities(tag ? (attr(tag, 'content') ?? '').trim() : '');
}

function jsonLdBlocks(html: string): string[] {
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  return [...html.matchAll(re)].map((m) => m[1]);
}

function jsonLdNodes(html: string): Json[] {
  const nodes: Json[] = [];
  const add = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(add);
    else if (v && typeof v === 'object') {
      const o = v as Json;
      if (Array.isArray(o['@graph'])) add(o['@graph']);
      if (o['@type']) nodes.push(o);
    }
  };
  for (const block of jsonLdBlocks(html)) add(JSON.parse(block));
  return nodes;
}

const hasType = (n: Json, type: string) => ([] as unknown[]).concat(n['@type']).includes(type);

function toolPages(): DistPage[] {
  const pages = distPages();
  return PLAN_TOOL_SLUGS.map((slug) => {
    const p = pages.find((x) => x.route === `/${slug}`);
    expect(p, `dist/${slug}/index.html must exist`).toBeDefined();
    return p!;
  });
}

function sitemapLocs(): string[] {
  requireDist();
  const files = readdirSync(DIST).filter((f) => /^sitemap.*\.xml$/.test(f));
  expect(files.length, 'dist/sitemap*.xml must exist').toBeGreaterThan(0);
  return files.flatMap((f) => [...readDist(f).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]));
}

describe('U24 seo', () => {
  it('every page has exactly one absolute https canonical URL matching its route', () => {
    for (const p of distPages()) {
      const canon = tags(p.html, 'link').filter((t) => attr(t, 'rel')?.toLowerCase() === 'canonical');
      expect(canon.length, `canonical links on ${p.route}`).toBe(1);
      const href = attr(canon[0], 'href') ?? '';
      expect(href, p.route).toMatch(/^https:\/\//);
      const path = new URL(href).pathname.replace(/\/$/, '') || '/';
      expect(path, p.route).toBe(p.route);
    }
  });

  it('every page has a non-empty title and description', () => {
    for (const p of distPages()) {
      expect(title(p.html), `title on ${p.route}`).not.toBe('');
      expect(description(p.html), `description on ${p.route}`).not.toBe('');
    }
  });

  it('titles and descriptions are unique across pages', () => {
    const pages = distPages();
    const dupes = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);
    expect(dupes(pages.map((p) => title(p.html)))).toEqual([]);
    expect(dupes(pages.map((p) => description(p.html)))).toEqual([]);
  });

  it('every JSON-LD block parses', () => {
    for (const p of distPages()) {
      for (const block of jsonLdBlocks(p.html)) {
        expect(() => JSON.parse(block), `JSON-LD on ${p.route}`).not.toThrow();
      }
    }
  });

  it('every tool page has SoftwareApplication JSON-LD with price 0', () => {
    for (const p of toolPages()) {
      const app = jsonLdNodes(p.html).find((n) => hasType(n, 'SoftwareApplication'));
      expect(app, `SoftwareApplication on ${p.route}`).toBeDefined();
      const offers = ([] as Json[]).concat((app!.offers as Json) ?? []);
      expect(offers.length, `offers on ${p.route}`).toBeGreaterThan(0);
      expect(Number(offers[0].price), `price on ${p.route}`).toBe(0);
    }
  });

  it('every tool page has FAQPage JSON-LD with 4 to 6 questions', () => {
    for (const p of toolPages()) {
      const faq = jsonLdNodes(p.html).find((n) => hasType(n, 'FAQPage'));
      expect(faq, `FAQPage on ${p.route}`).toBeDefined();
      const questions = ([] as Json[]).concat((faq!.mainEntity as Json) ?? []);
      expect(questions.length, `FAQ count on ${p.route}`).toBeGreaterThanOrEqual(4);
      expect(questions.length, `FAQ count on ${p.route}`).toBeLessThanOrEqual(6);
      for (const q of questions) {
        expect(hasType(q, 'Question'), p.route).toBe(true);
        expect(String(q.name ?? ''), p.route).not.toBe('');
        expect(String((q.acceptedAnswer as Json | undefined)?.text ?? ''), p.route).not.toBe('');
      }
    }
  });

  it('any other page with an FAQ section (id="faq") has FAQPage JSON-LD', () => {
    for (const p of distPages().filter((x) => /\sid\s*=\s*["']faq["']/i.test(x.html))) {
      expect(jsonLdNodes(p.html).some((n) => hasType(n, 'FAQPage')), `FAQPage on ${p.route}`).toBe(true);
    }
  });

  it('the sitemap lists every tool slug and the comparison page', () => {
    const paths = sitemapLocs().map((u) => new URL(u).pathname.replace(/\/$/, ''));
    for (const slug of [...PLAN_TOOL_SLUGS, 'no-watermark-video-editor']) {
      expect(paths, `sitemap entry for /${slug}`).toContain(`/${slug}`);
    }
  });

  it('robots.txt allows crawling and points at the sitemap', () => {
    requireDist();
    expect(existsSync(join(DIST, 'robots.txt')), 'dist/robots.txt must exist').toBe(true);
    const robots = readDist('robots.txt');
    expect(robots).toMatch(/^Sitemap:\s*https:\/\/\S+sitemap[^\s]*\.xml\s*$/im);
    expect(robots).not.toMatch(/^Disallow:\s*\/\s*$/im);
  });
});
