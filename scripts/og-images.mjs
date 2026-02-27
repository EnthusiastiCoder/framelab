#!/usr/bin/env node
// Renders the static Open Graph images (public/og/<page>.png, 1200x630) and the app icons (public/icons/*.png)
// from inline HTML/SVG with the bundled Playwright Chromium. No external service, no network. Flat colours keep
// each PNG small.
// Run after changing a tool title: node scripts/og-images.mjs   (the PNGs are committed; the build only copies them)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tools } from '../src/lib/tools.ts';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const ACCENT = '#4c3fd6';
const MARK = (size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="6" width="26" height="20" rx="5" fill="#fff" opacity="0.22"/><path d="M13 11.5v9l8-4.5z" fill="#fff"/></svg>`;

const pages = [
  { id: 'default', title: 'Free video tools that never upload your files', kicker: 'Framelab' },
  { id: 'no-watermark-video-editor', title: 'A free video editor with no watermark', kicker: 'Framelab' },
  ...tools.map((t) => ({ id: t.slug, title: t.title, kicker: 'Framelab', blurb: t.blurb })),
];

const ogHtml = (p) => `<!doctype html><html><head><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; font-family: 'Segoe UI', system-ui, sans-serif; color: #fff;
    background: ${ACCENT};
    padding: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 18px; font-size: 40px; font-weight: 700; }
  h1 { font-size: ${p.title.length > 32 ? 76 : 96}px; line-height: 1.05; font-weight: 800; max-width: 1000px; letter-spacing: -1px; }
  .blurb { font-size: 34px; opacity: 0.88; margin-top: 22px; max-width: 980px; }
  .pills { display: flex; gap: 16px; }
  .pill { font-size: 28px; font-weight: 600; padding: 12px 26px; border-radius: 999px; background: rgb(255 255 255 / 16%); }
</style></head><body>
  <div class="brand">${MARK(64)}<span>${p.kicker}</span></div>
  <div><h1>${p.title}</h1>${p.blurb ? `<p class="blurb">${p.blurb}</p>` : ''}</div>
  <div class="pills"><span class="pill">Free</span><span class="pill">No upload</span><span class="pill">No watermark</span><span class="pill">No sign-up</span></div>
</body></html>`;

/** maskable: the mark sits inside the 80% safe zone on a full-bleed background. */
const iconHtml = (size, maskable) => `<!doctype html><html><head><style>
  * { margin: 0; } body { width: ${size}px; height: ${size}px; display: grid; place-items: center;
    background: ${maskable ? ACCENT : 'transparent'}; }
  .tile { width: 100%; height: 100%; display: grid; place-items: center;
    border-radius: ${maskable ? 0 : Math.round(size * 0.22)}px; background: ${ACCENT}; }
</style></head><body><div class="tile">${MARK(Math.round(size * (maskable ? 0.56 : 0.72)))}</div></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  mkdirSync(`${PUBLIC}og`, { recursive: true });
  for (const p of pages) {
    await page.setContent(ogHtml(p));
    await page.screenshot({ path: `${PUBLIC}og/${p.id}.png` });
  }
  mkdirSync(`${PUBLIC}icons`, { recursive: true });
  const icons = [
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['maskable-512.png', 512, true],
    ['apple-touch-icon.png', 180, true],
  ];
  for (const [name, size, maskable] of icons) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(iconHtml(size, maskable));
    await page.screenshot({ path: `${PUBLIC}icons/${name}`, omitBackground: !maskable });
  }
  console.log(`og-images: ${pages.length} Open Graph images and ${icons.length} icons written`);
} finally {
  await browser.close();
}
