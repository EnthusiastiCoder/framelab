// E10 compress: Small preset output is smaller; target-size output within +-15%; resolution preserved.
// E22: Cancel mid-compress on the WebCodecs path stops within 1 s and frees the worker; the next job works.
import { test, expect } from '@playwright/test';
import { statSync } from 'node:fs';
import { FIXTURES, fixture } from '../helpers/fixtures';
import { engineChip, loadFile, openTool, runAndDownload } from '../helpers/app';
import { fill, radio } from '../helpers/ops';
import { probe } from '../helpers/probe';

test.describe('compress video', () => {
  test('E10 the Small preset makes the 1080p fixture smaller and keeps 1920x1080', async ({ page }, info) => {
    await openTool(page, 'compress-video');
    await loadFile(page, FIXTURES.hd1080);
    await radio(page, 'Small');
    const out = await runAndDownload(page, info.outputPath('out'));
    expect(statSync(out).size).toBeLessThan(statSync(fixture(FIXTURES.hd1080)).size);
    const p = await probe(out);
    expect(p.width).toBe(1920);
    expect(p.height).toBe(1080);
    expect(Math.abs(p.duration - 4)).toBeLessThanOrEqual(0.1);
  });

  test('E10 target size of 50% of the input lands within 15%', async ({ page }, info) => {
    const inputBytes = statSync(fixture(FIXTURES.hd1080)).size;
    const targetMB = (inputBytes * 0.5) / 1e6;
    await openTool(page, 'compress-video');
    await loadFile(page, FIXTURES.hd1080);
    await fill(page, 'Target size (MB)', targetMB.toFixed(3));
    const out = await runAndDownload(page, info.outputPath('out'));
    const ratio = statSync(out).size / (targetMB * 1e6);
    expect(ratio).toBeGreaterThanOrEqual(0.85);
    expect(ratio).toBeLessThanOrEqual(1.15);
    const p = await probe(out);
    expect(p.width).toBe(1920);
    expect(p.height).toBe(1080);
  });

  test('E22 Cancel mid-compress stops within 1 s and the next job works', async ({ page }, info) => {
    await openTool(page, 'compress-video');
    await loadFile(page, FIXTURES.hd1080);
    expect(await engineChip(page)).toContain('Fast (WebCodecs)');
    await radio(page, 'High quality');
    await page.getByTestId('run').click();
    await expect(page.getByTestId('progress')).toBeVisible();
    const t0 = Date.now();
    await page.getByTestId('cancel').click();
    await expect(page.getByTestId('progress')).toBeHidden({ timeout: 1_000 });
    expect(Date.now() - t0).toBeLessThanOrEqual(1_000);
    await expect(page.getByTestId('download')).toBeHidden();
    await expect(page.getByTestId('run')).toBeEnabled();
    await radio(page, 'Small');
    const p = await probe(await runAndDownload(page, info.outputPath('out')));
    expect(p.width).toBe(1920);
  });
});
