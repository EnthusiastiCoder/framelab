// E37: the empty state's sample-file button loads the tiny bundled sample (same-origin) and the tool runs on it.
// UI contract: a button named "Try a sample file" in the empty state; after it, loaded-file shows the sample's name,
// and export-summary shows the before/after size and duration.
import { test, expect } from '@playwright/test';
import { openTool, runAndDownload } from '../helpers/app';
import { recordRequests } from '../helpers/network';
import { probe } from '../helpers/probe';

test('E37 the sample-file button loads the bundled sample and mute runs on it', async ({ page, baseURL }, info) => {
  const net = recordRequests(page, baseURL!);
  await openTool(page, 'mute-video');
  await page.getByRole('button', { name: 'Try a sample file' }).click();
  await expect(page.getByTestId('loaded-file')).toBeVisible();
  await expect(page.getByTestId('loaded-file')).not.toBeEmpty();

  const out = await runAndDownload(page, info.outputPath('out'));
  const p = await probe(out);
  expect(p.videoTracks).toBe(1);
  expect(p.audioTracks).toBe(0);
  expect(p.duration).toBeGreaterThan(0);
  await expect(page.getByTestId('export-summary')).toContainText(/\d+(\.\d+)?\s?(KB|MB)/);
  expect(net.crossOrigin).toEqual([]);
});
