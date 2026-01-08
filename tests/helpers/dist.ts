// Readers for the built site in dist/ (WS4 unit checks run after `npm run build`).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

export const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));

/** Throws a clear error when the site has not been built. */
export function requireDist(): void {
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error('dist/index.html is missing: run "npm run build" first');
  }
}

export function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export interface DistPage {
  /** The route, e.g. "/" or "/compress-video" (no trailing slash except the root). */
  route: string;
  file: string;
  html: string;
}

/** Every dist/**\/index.html as a page, excluding the 404 and offline fallbacks. */
export function distPages(): DistPage[] {
  requireDist();
  return walk(DIST)
    .filter((f) => f.endsWith(`${sep}index.html`) || f === join(DIST, 'index.html'))
    .map((file) => {
      const rel = relative(DIST, file).split(sep).join('/');
      const route = rel === 'index.html' ? '/' : `/${rel.replace(/\/index\.html$/, '')}`;
      return { route, file, html: readFileSync(file, 'utf8') };
    })
    .filter((p) => !/^\/(404|offline)$/.test(p.route));
}

export function readDist(rel: string): string {
  return readFileSync(join(DIST, rel), 'utf8');
}

/** Value of an attribute in the first tag matching `tagRe` (attribute order independent). */
export function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

/** All opening tags of an element, e.g. tags(html, 'link'). */
export function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
