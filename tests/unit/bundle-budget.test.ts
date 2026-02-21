// U26 bundle budget: reads the built site. Run `npm run build` first.
// The initial JS graph of /compress-video = the module scripts of dist/compress-video/index.html
// (<script type="module" src>, inline module scripts, <link rel="modulepreload">, and the component-url /
// renderer-url of every <astro-island>), plus everything those files import STATICALLY (dynamic import() is lazy).
// Budget: the gzip size of that graph is at most 150 KB (150 * 1024 bytes).
// Naming contract (astro.config.mjs manualChunks): the heavy engines are split into their own chunks under
// dist/_astro/: the mediabunny core ("mediabunny-*.js", not an encoder), the MP3 encoder ("*mp3-encoder*"),
// the speech-recognition worker ("asr-worker-*") and transformers.js ("*transformers*"); none of them may be in
// the initial graph. (v1 has no ffmpeg.wasm, by decision, so the plan's "ffmpeg" chunk became the MP3 encoder and
// the ASR worker: the same intent, heavy engines load lazily, checked for more chunks.)
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, posix } from 'node:path';
import { DIST, attr, readDist, requireDist, tags } from '../helpers/dist';

const PAGE = 'compress-video/index.html';
const BUDGET = 150 * 1024;
const HEAVY: Array<[string, RegExp]> = [
  ['mediabunny core', /^mediabunny-(?!mp3|flac)/],
  ['MP3 encoder', /mp3-encoder/],
  ['ASR worker', /^asr-worker-/],
  ['transformers', /transformers/],
];

const STATIC_IMPORT = /(?:^|[;\s}])(?:import|export)\s*(?:[\w$*{},\s]*?\s*from\s*)?["']([^"']+\.m?js)["']/g;

function entryUrls(html: string): { urls: string[]; inline: string[] } {
  const urls: string[] = [];
  const inline: string[] = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(scriptRe)) {
    const open = `<script${m[1]}>`;
    if (attr(open, 'type') !== 'module') continue;
    const src = attr(open, 'src');
    if (src) urls.push(src);
    else inline.push(m[2]);
  }
  for (const t of tags(html, 'link')) {
    if (attr(t, 'rel') === 'modulepreload' && attr(t, 'href')) urls.push(attr(t, 'href')!);
  }
  for (const t of tags(html, 'astro-island')) {
    for (const a of ['component-url', 'renderer-url']) {
      const u = attr(t, a);
      if (u) urls.push(u);
    }
  }
  return { urls, inline };
}

/** Resolves a site path ("/_astro/x.js") or a relative import against the importing file's site path. */
function resolve(spec: string, from: string): string {
  if (spec.startsWith('/')) return spec;
  return posix.normalize(posix.join(posix.dirname(from), spec));
}

function initialGraph(): string[] {
  requireDist();
  expect(existsSync(join(DIST, PAGE)), `dist/${PAGE} must exist`).toBe(true);
  const { urls, inline } = entryUrls(readDist(PAGE));
  const seen = new Set<string>();
  const queue = [...urls.map((u) => resolve(u, '/compress-video/'))];
  for (const code of inline) for (const m of code.matchAll(STATIC_IMPORT)) queue.push(resolve(m[1], '/compress-video/'));
  while (queue.length) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const file = join(DIST, url.replace(/^\//, ''));
    expect(existsSync(file), `dist${url} (in the initial graph) must exist`).toBe(true);
    for (const m of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) queue.push(resolve(m[1], url));
  }
  return [...seen];
}

describe('U26 bundle budget', () => {
  it('/compress-video loads at least one module script', () => {
    expect(initialGraph().length).toBeGreaterThan(0);
  });

  it('the initial JS of /compress-video is at most 150 KB gzip', () => {
    const graph = initialGraph();
    const total = graph.reduce((sum, url) => sum + gzipSync(readFileSync(join(DIST, url.replace(/^\//, '')))).length, 0);
    expect(total, `initial graph: ${graph.join(', ')}`).toBeLessThanOrEqual(BUDGET);
  });

  it('the mediabunny core, MP3 encoder, ASR worker and transformers chunks exist in dist/_astro', () => {
    requireDist();
    const files = readdirSync(join(DIST, '_astro')).filter((f) => f.endsWith('.js'));
    for (const [name, re] of HEAVY) {
      expect(files.some((f) => re.test(f.toLowerCase())), `a dist/_astro chunk for the ${name} (${re})`).toBe(true);
    }
  });

  it('no mediabunny, MP3 encoder, ASR worker or transformers chunk is in the initial graph', () => {
    const heavy = initialGraph().filter((u) => HEAVY.some(([, re]) => re.test(posix.basename(u).toLowerCase())));
    expect(heavy).toEqual([]);
  });
});
