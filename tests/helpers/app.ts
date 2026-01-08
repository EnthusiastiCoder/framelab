// UI contract shared by the e2e specs. The islands must expose these test ids:
//   dropzone            the DropZone root; contains the <input type="file">
//   run                 the primary action button of the tool (Mute, Compress, ...)
//   progress            the ProgressPanel (phase, percent, ETA)       cancel   its Cancel button
//   download            the ExportPanel download button/link (triggers a browser download)
//   engine-chip         "Engine: Fast (WebCodecs)" or "Engine: Compatibility (ffmpeg)"
//   error-card          the ErrorCard; error-next-step  its concrete next step
//   capability-banner   the CapabilityBanner
//   network-proof       the NetworkProof badge ("0 requests to other sites")
//   memory-warning      the memory warning, with buttons named "Continue" and "Lower quality"
//   keyframe-note       the Fast-trim keyframe note
//   loaded-file         (WS4) the loaded input's file name, shown once a file is in the tool
//   export-summary      (WS4) the before/after size and duration summary next to the download
// Tool options are form controls reachable by their visible label (getByLabel).
import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from './fixtures';

export async function openTool(page: Page, slug: string, query = ''): Promise<void> {
  const res = await page.goto(`/${slug}${query}`);
  expect(res?.status(), `/${slug} status`).toBe(200);
  await expect(page.getByTestId('dropzone')).toBeVisible();
}

export async function loadFile(page: Page, name: string): Promise<void> {
  await page.getByTestId('dropzone').locator('input[type="file"]').setInputFiles(fixture(name));
}

export async function loadFiles(page: Page, names: string[]): Promise<void> {
  await page.getByTestId('dropzone').locator('input[type="file"]').setInputFiles(names.map(fixture));
}

/** Clicks run, waits for the export to be offered and saves the download. Returns the saved path. */
export async function runAndDownload(page: Page, outDir: string, timeout = 120_000): Promise<string> {
  await page.getByTestId('run').click();
  return download(page, outDir, timeout);
}

export async function download(page: Page, outDir: string, timeout = 120_000): Promise<string> {
  const button = page.getByTestId('download');
  await expect(button).toBeVisible({ timeout });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout }), button.click()]);
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, dl.suggestedFilename());
  await dl.saveAs(target);
  return target;
}

export async function engineChip(page: Page): Promise<string> {
  return (await page.getByTestId('engine-chip').innerText()).trim();
}
