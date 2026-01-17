// E35: Lighthouse thresholds. The test runs `npm run lh` with LH_BASE_URL set to the e2e base URL, then asserts
// the JSON reports it wrote. Contract for the `lh` script: it audits /, /compress-video and /auto-subtitles with
// the mobile default and with --preset=desktop, and writes one Lighthouse JSON report per run to
// test-results/lighthouse/*.json (any file names). Mobile thresholds: Performance >= 90, Accessibility 100,
// Best Practices >= 95, SEO 100.
import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'test-results', 'lighthouse');
const PAGES = ['/', '/compress-video', '/auto-subtitles'];

interface Report {
  requestedUrl?: string;
  finalDisplayedUrl?: string;
  configSettings: { formFactor: string };
  categories: Record<string, { score: number | null }>;
}

test('E35 Lighthouse mobile scores meet the thresholds on /, /compress-video and /auto-subtitles', async ({
  baseURL,
}) => {
  test.setTimeout(900_000);
  rmSync(OUT, { recursive: true, force: true });
  const run = spawnSync('npm run lh', {
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, LH_BASE_URL: baseURL! },
    timeout: 840_000,
  });
  expect(run.status, `npm run lh failed:\n${run.stdout}\n${run.stderr}`).toBe(0);
  expect(existsSync(OUT), 'npm run lh must write test-results/lighthouse/*.json').toBe(true);

  const reports: Report[] = readdirSync(OUT)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(OUT, f), 'utf8')));
  const pathOf = (r: Report) => new URL(r.requestedUrl ?? r.finalDisplayedUrl ?? '').pathname.replace(/(.)\/$/, '$1');

  for (const path of PAGES) {
    for (const formFactor of ['mobile', 'desktop']) {
      expect(
        reports.some((r) => pathOf(r) === path && r.configSettings.formFactor === formFactor),
        `a ${formFactor} report for ${path}`,
      ).toBe(true);
    }
    const r = reports.find((x) => pathOf(x) === path && x.configSettings.formFactor === 'mobile')!;
    const score = (c: string) => Math.round((r.categories[c]?.score ?? 0) * 100);
    expect(score('performance'), `${path} performance`).toBeGreaterThanOrEqual(90);
    expect(score('accessibility'), `${path} accessibility`).toBe(100);
    expect(score('best-practices'), `${path} best practices`).toBeGreaterThanOrEqual(95);
    expect(score('seo'), `${path} SEO`).toBe(100);
  }
});
