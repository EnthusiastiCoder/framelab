// E3: /mute-video on the WebCodecs path.
// E4 (adapted, CTO: v1 is WebCodecs-only): without WebCodecs the page shows the unsupported-browser notice.
// E6 (adapted): Cancel on the WebCodecs mute job, slowed by the ?slow=1 test hook so there is time to cancel.
import { test, expect } from '@playwright/test';
import { basename } from 'node:path';
import { FIXTURES } from '../helpers/fixtures';
import { engineChip, loadFile, openTool, runAndDownload } from '../helpers/app';
import { probe } from '../helpers/probe';
import { recordPageErrors } from '../helpers/network';

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

  test('E4 without WebCodecs the page says the browser is unsupported and names the alternatives', async ({ page }) => {
    const errors = recordPageErrors(page);
    await page.addInitScript(() => {
      // @ts-expect-error deleting platform globals on purpose
      delete window.VideoEncoder;
      // @ts-expect-error deleting platform globals on purpose
      delete window.VideoDecoder;
    });
    await openTool(page, 'mute-video');
    const notice = page.getByTestId('unsupported-browser');
    await expect(notice).toBeVisible();
    const text = await notice.innerText();
    for (const name of ['Chrome', 'Edge', 'Safari', 'Firefox']) expect(text).toContain(name);
    await expect(page.getByTestId('run')).toBeDisabled();
    expect(errors.map((e) => e.message)).toEqual([]);
  });

  test('E6 Cancel during the mute job returns to ready, and a second run succeeds', async ({ page }, info) => {
    await openTool(page, 'mute-video', '?slow=1');
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
