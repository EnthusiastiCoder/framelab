// E34: offline. After a first visit and the service worker install (the page is controlled), the network is
// disabled with context.setOffline(true); a reload of /trim-video still loads and an exact trim completes.
import { test, expect } from '@playwright/test';
import { FIXTURES } from '../helpers/fixtures';
import { loadFile, runAndDownload } from '../helpers/app';
import { radio, setRange } from '../helpers/ops';
import { probe } from '../helpers/probe';

test('E34 /trim-video loads and trims with the network disabled after one visit', async ({ page, context }, info) => {
  test.setTimeout(240_000);
  const res = await page.goto('/trim-video');
  expect(res?.status()).toBe(200);
  // Wait for the service worker to activate, then make sure it controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('dropzone')).toBeVisible();

  await loadFile(page, FIXTURES.h264);
  await radio(page, 'Exact');
  await setRange(page, 1, 3);
  const p = await probe(await runAndDownload(page, info.outputPath('out')));
  expect(Math.abs(p.duration - 2)).toBeLessThanOrEqual(0.034);
  await context.setOffline(false);
});
