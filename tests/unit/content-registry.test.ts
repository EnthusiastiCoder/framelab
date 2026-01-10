// U9 content/registry: src/lib/tools.ts + src/content/tools/<slug>.md
// API: src/lib/tools.ts exports `tools: Array<{ slug: string; ... }>` and must be importable in Node
//      (island components referenced lazily, e.g. `load: () => import('../components/tools/MuteVideo.svelte')`).
// Content files carry YAML frontmatter with at least `title:` and `description:` on single lines.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const CONTENT_DIR = fileURLToPath(new URL('../../src/content/tools/', import.meta.url));
const loadRegistry = () => import('../../src/lib/tools');

function contentSlugs(): string[] {
  expect(existsSync(CONTENT_DIR), 'src/content/tools/ must exist').toBe(true);
  return readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .sort();
}

function frontmatterField(text: string, field: string): string {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fm) throw new Error('missing frontmatter');
  const line = new RegExp(`^${field}:\\s*(.+)$`, 'm').exec(fm[1]);
  if (!line) throw new Error(`missing ${field}`);
  return line[1].trim().replace(/^(['"])(.*)\1$/, '$2');
}

function readMeta() {
  return contentSlugs().map((slug) => {
    const text = readFileSync(join(CONTENT_DIR, `${slug}.md`), 'utf8');
    return { slug, title: frontmatterField(text, 'title'), description: frontmatterField(text, 'description') };
  });
}

describe('U9 content and registry', () => {
  it('the registry contains mute-video', async () => {
    const { tools } = await loadRegistry();
    expect(tools.map((t: { slug: string }) => t.slug)).toContain('mute-video');
  });

  it('every registry slug has a content file and the other way round', async () => {
    const { tools } = await loadRegistry();
    const registry = tools.map((t: { slug: string }) => t.slug).sort();
    expect(new Set(registry).size).toBe(registry.length);
    expect(contentSlugs()).toEqual(registry);
  });

  it('titles are at most 60 characters', () => {
    for (const m of readMeta()) expect(m.title.length, `${m.slug} title`).toBeLessThanOrEqual(60);
  });

  it('descriptions are 120 to 160 characters', () => {
    for (const m of readMeta()) {
      expect(m.description.length, `${m.slug} description`).toBeGreaterThanOrEqual(120);
      expect(m.description.length, `${m.slug} description`).toBeLessThanOrEqual(160);
    }
  });

  it('titles and descriptions are unique across pages', () => {
    const meta = readMeta();
    expect(meta.length).toBeGreaterThan(0);
    expect(new Set(meta.map((m) => m.title)).size).toBe(meta.length);
    expect(new Set(meta.map((m) => m.description)).size).toBe(meta.length);
  });
});
