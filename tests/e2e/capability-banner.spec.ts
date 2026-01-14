// E8 @cross: a CapabilityBanner appears when VideoEncoder is deleted through an init script,
// and the tool still works through ffmpeg.
import { test, expect } from '@playwright/test';
import { FIXTURES } from '../helpers/fixtures';
import { engineChip, loadFile, openTool, runAndDownload } from '../helpers/app';
import { probe } from '../helpers/probe';

test('E8 without VideoEncoder the banner shows and mute works via ffmpeg @cross', async ({ page }, info) => {
  await page.addInitScript(() => {
    // @ts-expect-error deleting a platform global on purpose
    delete window.VideoEncoder;
  });
  await openTool(page, 'mute-video');
  const banner = page.getByTestId('capability-banner');
  await expect(banner).toBeVisible();
  expect((await banner.innerText()).trim().length).toBeGreaterThan(10);
  await loadFile(page, FIXTURES.h264);
  expect(await engineChip(page)).toContain('Compatibility');
  const p = await probe(await runAndDownload(page, info.outputPath('out')));
  expect(p.audioTracks).toBe(0);
  expect(p.videoTracks).toBe(1);
  expect(Math.abs(p.duration - 5)).toBeLessThanOrEqual(0.1);
});

test('E8 the banner is absent when everything is supported', async ({ page }) => {
  await openTool(page, 'mute-video');
  await expect(page.getByTestId('capability-banner')).toBeHidden();
});
