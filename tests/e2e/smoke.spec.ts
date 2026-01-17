// E40 @smoke: the subset run against the live URL in WS6 (BASE_URL=https://... npx playwright test --grep @smoke).
// The home page and 3 tool pages load with COOP/COEP, crossOriginIsolated is true, and mute completes.
// Self-contained on purpose: it does not import src/ (the live run has no source tree to read).
import { test, expect } from '@playwright/test';
import { FIXTURES } from '../helpers/fixtures';
import { loadFile, openTool, runAndDownload } from '../helpers/app';
import { probe } from '../helpers/probe';

const PAGES = ['/', '/compress-video', '/mute-video', '/auto-subtitles'];

test.describe('smoke', () => {
  for (const path of PAGES) {
    test(`E40 ${path} loads with COOP/COEP and is cross-origin isolated @smoke`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      const h = await res!.allHeaders();
      expect(h['cross-origin-opener-policy']).toBe('same-origin');
      expect(h['cross-origin-embedder-policy']).toBe('require-corp');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
    });
  }

  test('E40 mute completes @smoke', async ({ page }, info) => {
    await openTool(page, 'mute-video');
    await loadFile(page, FIXTURES.h264);
    const p = await probe(await runAndDownload(page, info.outputPath('out')));
    expect(p.videoTracks).toBe(1);
    expect(p.audioTracks).toBe(0);
    expect(Math.abs(p.duration - 5)).toBeLessThanOrEqual(0.1);
  });
});
