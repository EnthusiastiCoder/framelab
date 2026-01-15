// E23: forced memory warning (deviceMemory=2, no FSA, 1080p fixture, ?memtest lowers the threshold)
//      shows the warning with Continue / Lower quality, and Continue completes.
// E24 no watermark: frame at t=1.0 s of a compress output vs the input frame: mean absolute pixel
//      difference under a small threshold in every corner region (no logo overlay).
import { test, expect } from '@playwright/test';
import { FIXTURES, fixture } from '../helpers/fixtures';
import { loadFile, openTool, runAndDownload, download } from '../helpers/app';
import { radio } from '../helpers/ops';
import { probe } from '../helpers/probe';
import { framePixels, meanAbsDiff, type Region } from '../helpers/frames';

test('E23 a forced memory warning offers Continue and Lower quality; Continue completes', async ({ page }, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 2, configurable: true });
    // @ts-expect-error removing File System Access on purpose
    delete window.showSaveFilePicker;
  });
  await openTool(page, 'compress-video', '?memtest');
  await loadFile(page, FIXTURES.hd1080);
  await radio(page, 'High quality');
  await page.getByTestId('run').click();
  const warning = page.getByTestId('memory-warning');
  await expect(warning).toBeVisible();
  await expect(warning.getByRole('button', { name: 'Continue' })).toBeVisible();
  await expect(warning.getByRole('button', { name: 'Lower quality' })).toBeVisible();
  await warning.getByRole('button', { name: 'Continue' }).click();
  const p = await probe(await download(page, info.outputPath('out')));
  expect([p.width, p.height]).toEqual([1920, 1080]);
});

test('E24 compress adds no watermark in any corner', async ({ page }, info) => {
  await openTool(page, 'compress-video');
  await loadFile(page, FIXTURES.hd1080);
  await radio(page, 'Balanced');
  const out = await runAndDownload(page, info.outputPath('out'));
  const corners: Region[] = [
    { x: 0, y: 0, w: 0.2, h: 0.2 },
    { x: 0.8, y: 0, w: 0.2, h: 0.2 },
    { x: 0, y: 0.8, w: 0.2, h: 0.2 },
    { x: 0.8, y: 0.8, w: 0.2, h: 0.2 },
  ];
  const a = await framePixels(page, fixture(FIXTURES.hd1080), 'video/mp4', 1.0, corners);
  const b = await framePixels(page, out, 'video/mp4', 1.0, corners);
  expect([b.width, b.height]).toEqual([a.width, a.height]);
  for (let i = 0; i < corners.length; i++) {
    expect(meanAbsDiff(a.regions[i], b.regions[i]), `corner ${i}`).toBeLessThan(12);
  }
});
