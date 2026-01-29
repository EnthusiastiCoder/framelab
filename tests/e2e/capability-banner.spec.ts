// E8 @cross: a CapabilityBanner appears when VideoEncoder is deleted through an init script.
// Adapted (CTO: v1 is WebCodecs-only, no ffmpeg fallback): instead of "mute works via ffmpeg", the tool shows the
// unsupported-browser notice naming the browsers to use, the run button stays disabled, and nothing throws.
import { test, expect } from '@playwright/test';
import { openTool } from '../helpers/app';
import { recordPageErrors } from '../helpers/network';

test('E8 without VideoEncoder the banner and the unsupported notice show @cross', async ({ page }) => {
  const errors = recordPageErrors(page);
  await page.addInitScript(() => {
    // @ts-expect-error deleting a platform global on purpose
    delete window.VideoEncoder;
  });
  await openTool(page, 'mute-video');
  const banner = page.getByTestId('capability-banner');
  await expect(banner).toBeVisible();
  expect((await banner.innerText()).trim().length).toBeGreaterThan(10);
  const notice = page.getByTestId('unsupported-browser');
  await expect(notice).toBeVisible();
  const text = await notice.innerText();
  for (const name of ['Chrome', 'Edge', 'Safari', 'Firefox']) expect(text).toContain(name);
  await expect(page.getByTestId('run')).toBeDisabled();
  expect(errors.map((e) => e.message)).toEqual([]);
});

test('E8 the banner is absent when everything is supported', async ({ page }) => {
  await openTool(page, 'mute-video');
  await expect(page.getByTestId('capability-banner')).toBeHidden();
});
