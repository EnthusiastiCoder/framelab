// sitemap.xml, prerendered at build time: the home page, every tool page and the trust pages.
// (A small endpoint instead of @astrojs/sitemap: no extra dependency, and the 404 and offline pages stay out.)
import type { APIRoute } from 'astro';
import { tools } from '../lib/tools';
import { canonicalUrl } from '../lib/seo';

const PAGES = ['/', ...tools.map((t) => `/${t.slug}`), '/no-watermark-video-editor', '/privacy', '/licenses', '/about'];

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://framelab.pages.dev');
  const urls = PAGES.map((p) => `  <url><loc>${canonicalUrl(base, p)}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
