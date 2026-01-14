// E7: keyboard only: Tab to the drop zone, Enter opens the file chooser, run and export with the keyboard.
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES, fixture } from '../helpers/fixtures';
import { probe } from '../helpers/probe';

/** Presses Tab until the focused element is (or is inside) the element with the test id. */
async function tabTo(page: Page, testId: string, max = 40): Promise<void> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate((id) => {
      const el = document.activeElement;
      return !!el && !!el.closest(`[data-testid="${id}"]`);
    }, testId);
    if (hit) return;
  }
  throw new Error(`could not reach [data-testid=${testId}] with Tab`);
}

test('E7 the whole mute flow works with the keyboard only', async ({ page }, info) => {
  await page.goto('/mute-video');
  await tabTo(page, 'dropzone');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  await chooser.setFiles(fixture(FIXTURES.h264));
  await tabTo(page, 'run');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('download')).toBeVisible({ timeout: 120_000 });
  await tabTo(page, 'download');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  const out = info.outputPath('out');
  mkdirSync(out, { recursive: true });
  const target = join(out, dl.suggestedFilename());
  await dl.saveAs(target);
  const p = await probe(target);
  expect(p.audioTracks).toBe(0);
  expect(p.videoTracks).toBe(1);
});

test('E7 the skip link is the first Tab stop and moves focus to the main content', async ({ page }) => {
  await page.goto('/mute-video');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: /skip to (main )?content/i });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => !!document.activeElement?.closest('main') || location.hash.length > 1)).toBe(true);
});
