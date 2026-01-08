// UI contract for the subtitle tools.
//   run                    "Generate subtitles"
//   model-select           <select> labelled "Model" (whisper-tiny / base / small)
//   button "Download model" -> model-notice (size, "your audio never leaves this device"),
//                              with buttons "Download" and "Not now" and a "Remember my choice" checkbox
//   subtitle-editor        the editor; one [data-testid=cue] per cue, containing:
//                          textbox "Cue text", buttons "Start -0.1 s", "Start +0.1 s", "End -0.1 s", "End +0.1 s",
//                          "Split", "Merge with next", "Delete"; Ctrl+Z undo, Ctrl+Shift+Z redo
//   download-srt, download-vtt   export buttons;   burn   starts the burn-in, then the usual "download"
//   subtitle-file          <input type=file> for an SRT/VTT on /burn-subtitles
// ?asr=mock makes the ASR worker return MOCK_CHUNKS without any model download.
import { expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MOCK_CHUNKS = [
  { text: 'Hello and welcome to Framelab.', timestamp: [0.5, 1.8] },
  { text: 'Everything here runs in your browser.', timestamp: [2.0, 3.4] },
  { text: 'Your files never leave your device.', timestamp: [3.6, 4.9] },
] as const;

export async function saveFrom(page: Page, testId: string, outDir: string): Promise<string> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testId).click()]);
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, dl.suggestedFilename());
  await dl.saveAs(target);
  return target;
}

export async function waitForEditor(page: Page, timeout = 120_000) {
  const editor = page.getByTestId('subtitle-editor');
  await expect(editor).toBeVisible({ timeout });
  return editor;
}

export const readText = (p: string) => readFileSync(p, 'utf8');
