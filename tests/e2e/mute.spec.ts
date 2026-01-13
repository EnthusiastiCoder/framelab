// E3: /mute-video on the WebCodecs path. E4: the same with ?engine=ffmpeg. E6: Cancel on the ffmpeg job.
import { test, expect } from '@playwright/test';
import { basename } from 'node:path';
import { FIXTURES } from '../helpers/fixtures';
import { engineChip, loadFile, openTool, runAndDownload } from '../helpers/app';
import { probe } from '../helpers/probe';

async function expectMuted(path: string) {
  expect(basename(path)).toMatch(/-framelab\.mp4$/);
  const p = await probe(path);
  expect(p.videoTracks).toBe(1);
  expect(p.audioTracks).toBe(0);
  expect(Math.abs(p.duration - 5)).toBeLessThanOrEqual(0.1);
  expect(p.width).toBe(640);
  expect(p.height).toBe(360);
}

test.describe('mute video', () => {
  test('E3 mutes h264-aac-640x360-5s.mp4 on the fast path', async ({ page }, info) => {
    await openTool(page, 'mute-video');
    await loadFile(page, FIXTURES.h264);
    expect(await engineChip(page)).toContain('Fast (WebCodecs)');
    await expectMuted(await runAndDownload(page, info.outputPath('out')));
  });

  test('E4 mutes on the ffmpeg path and the chip says Compatibility', async ({ page }, info) => {
    await openTool(page, 'mute-video', '?engine=ffmpeg');
    expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
    await loadFile(page, FIXTURES.h264);
    expect(await engineChip(page)).toContain('Compatibility (ffmpeg)');
    await expectMuted(await runAndDownload(page, info.outputPath('out')));
  });

  test('E6 Cancel during the ffmpeg mute job returns to ready, and a second run succeeds', async ({ page }, info) => {
    await openTool(page, 'mute-video', '?engine=ffmpeg');
    await loadFile(page, FIXTURES.h264);
    await page.getByTestId('run').click();
    await expect(page.getByTestId('progress')).toBeVisible();
    await page.getByTestId('cancel').click();
    await expect(page.getByTestId('progress')).toBeHidden({ timeout: 5_000 });
    await expect(page.getByTestId('download')).toBeHidden();
    await expect(page.getByTestId('error-card')).toBeHidden();
    await expect(page.getByTestId('run')).toBeEnabled();
    await expectMuted(await runAndDownload(page, info.outputPath('out')));
  });
});
