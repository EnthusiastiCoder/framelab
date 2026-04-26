// `npm run lh`: Lighthouse on /, /compress-video and /auto-subtitles, mobile default and --preset=desktop, one JSON
// report per run in test-results/lighthouse/ (contract of tests/e2e/lighthouse.spec.ts, E35).
// Lighthouse is not a dependency yet (disk space); install it with `npm i -D lighthouse` to run this.
// It never downloads Lighthouse on the fly. Base URL: LH_BASE_URL (default http://localhost:4799).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const BIN = join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'lighthouse.cmd' : 'lighthouse');
if (!existsSync(BIN)) {
  console.error('Lighthouse is not installed (deferred: disk space). Install it with `npm i -D lighthouse`, then run `npm run lh`.');
  process.exit(1);
}

const BASE = process.env.LH_BASE_URL ?? 'http://localhost:4799';
const OUT = join(ROOT, 'test-results', 'lighthouse');
const PAGES = ['/', '/compress-video', '/auto-subtitles'];
mkdirSync(OUT, { recursive: true });

let chromePath = process.env.CHROME_PATH;
if (!chromePath) {
  try {
    const { chromium } = await import('@playwright/test');
    chromePath = chromium.executablePath();
  } catch {
    /* let Lighthouse find a Chrome */
  }
}

let failed = false;
for (const page of PAGES) {
  for (const preset of ['mobile', 'desktop']) {
    const name = `${page === '/' ? 'home' : page.slice(1)}-${preset}.json`;
    const args = [
      new URL(page, BASE).href,
      '--output=json',
      `--output-path=${join(OUT, name)}`,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--chrome-flags=--headless=new',
      '--quiet',
    ];
    if (preset === 'desktop') args.push('--preset=desktop');
    const run = spawnSync(BIN, args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...(chromePath ? { CHROME_PATH: chromePath } : {}) } });
    if (run.status !== 0) failed = true;
  }
}
process.exit(failed ? 1 : 0);
