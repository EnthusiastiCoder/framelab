// Screenshots of the built site (dev tool, not part of the build). Serve dist/ first (`npm run preview`).
//   node scripts/screenshots.mjs <outDir>            every page at 1280 and 375 px wide, light and dark (UI review)
//   node scripts/screenshots.mjs --readme            the README set into docs/screenshots/
// BASE overrides the site URL (default http://localhost:4799).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:4799';
const readme = process.argv.includes('--readme');
const out = readme ? join(process.cwd(), 'docs', 'screenshots') : process.argv[2];
if (!out) {
  console.error('Usage: node scripts/screenshots.mjs <outDir> | --readme');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const { tools } = await import('../src/lib/tools.ts');
const pages = ['/', '/privacy', '/licenses', '/about', '/no-watermark-video-editor', '/offline', ...tools.map((t) => `/${t.slug}`)];

const shots = readme
  ? [
      { path: '/', width: 1280, scheme: 'light', name: 'home-light', full: false },
      { path: '/compress-video', width: 1280, scheme: 'light', name: 'compress-video-light', full: false },
      { path: '/trim-video', width: 1280, scheme: 'dark', name: 'trim-video-dark', full: false },
      { path: '/mute-video', width: 375, scheme: 'light', name: 'mute-video-mobile', full: false },
    ]
  : pages.flatMap((path) =>
      [1280, 375].flatMap((width) =>
        ['light', 'dark'].map((scheme) => ({
          path,
          width,
          scheme,
          name: `${path === '/' ? 'home' : path.slice(1)}-${width}-${scheme}`,
          full: true,
        })),
      ),
    );

const browser = await chromium.launch();
for (const s of shots) {
  const context = await browser.newContext({
    viewport: { width: s.width, height: s.width < 600 ? 812 : 800 },
    colorScheme: s.scheme,
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  await page.goto(new URL(s.path, BASE).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `${s.name}.png`), fullPage: s.full });
  await context.close();
}
await browser.close();
console.log(`screenshots: ${shots.length} written to ${out}`);
