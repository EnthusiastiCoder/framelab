// E25 @subs: with ?asr=mock, speech-en.mp4 opens the editor with >= 3 cues; SRT and VTT downloads parse and match.
// E26 @subs: before clicking Download model there are 0 model requests; declining keeps it at 0.
//   Decision 3 (WS0): models are same-origin (/models/...), so "0 requests to huggingface.co" became
//   "0 requests to /models/ and 0 cross-origin requests".
// E27 @subs: editor actions (edit, nudge, split, merge, delete, undo/redo) are reflected in the export.
// E31 @subs: "Delete downloaded models" on /privacy empties the model cache.
import { test, expect } from '@playwright/test';
import { FIXTURES } from '../helpers/fixtures';
import { loadFile, openTool } from '../helpers/app';
import { recordRequests } from '../helpers/network';
import { MOCK_CHUNKS, readText, saveFrom, waitForEditor } from '../helpers/subtitles';

const loadSrt = () => import('../../src/subtitles/srt');
const loadVtt = () => import('../../src/subtitles/vtt');

test.describe('auto-subtitles', () => {
  test('E25 mock ASR fills the editor and both exports parse @subs', async ({ page }, info) => {
    await openTool(page, 'auto-subtitles', '?asr=mock');
    await loadFile(page, FIXTURES.speechMp4);
    await page.getByTestId('run').click();
    const editor = await waitForEditor(page);
    const count = await editor.getByTestId('cue').count();
    expect(count).toBeGreaterThanOrEqual(3);
    const { parseSrt } = await loadSrt();
    const { parseVtt } = await loadVtt();
    const srt = parseSrt(readText(await saveFrom(page, 'download-srt', info.outputPath('out'))));
    const vtt = parseVtt(readText(await saveFrom(page, 'download-vtt', info.outputPath('out'))));
    expect(srt).toHaveLength(count);
    expect(vtt).toHaveLength(count);
    expect(srt[0].text).toBe(MOCK_CHUNKS[0].text);
  });

  test('E26 no model request before Download model, and none after declining @subs', async ({ page, baseURL }) => {
    const net = recordRequests(page, baseURL!);
    await openTool(page, 'auto-subtitles');
    await loadFile(page, FIXTURES.speechMp4);
    await page.getByTestId('run').click();
    await page.waitForTimeout(1_000);
    expect(net.matching(/\/models\//)).toEqual([]);
    await page.getByRole('button', { name: 'Download model' }).click();
    const notice = page.getByTestId('model-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/\d+(\.\d+)?\s?MB/);
    await expect(notice).toContainText(/never leaves (this|your) device/i);
    await notice.getByRole('button', { name: 'Not now' }).click();
    await expect(notice).toBeHidden();
    await page.waitForTimeout(1_000);
    expect(net.matching(/\/models\//)).toEqual([]);
    expect(net.crossOrigin).toEqual([]);
  });

  test('E27 editor actions are reflected in the export @subs', async ({ page }, info) => {
    await openTool(page, 'auto-subtitles', '?asr=mock');
    await loadFile(page, FIXTURES.speechMp4);
    await page.getByTestId('run').click();
    const editor = await waitForEditor(page);
    const cues = editor.getByTestId('cue');
    const n0 = await cues.count();

    // edit text
    await cues.nth(0).getByRole('textbox', { name: 'Cue text' }).fill('Edited first cue');
    // nudge: start of cue 0 +0.1 s
    await cues.nth(0).getByRole('button', { name: 'Start +0.1 s' }).click();
    // split cue 1 at the cursor (cursor after the first word)
    const t1 = cues.nth(1).getByRole('textbox', { name: 'Cue text' });
    await t1.click();
    await t1.press('Home');
    for (let i = 0; i < 'Everything'.length; i++) await t1.press('ArrowRight');
    await cues.nth(1).getByRole('button', { name: 'Split' }).click();
    await expect(cues).toHaveCount(n0 + 1);
    // merge it back
    await cues.nth(1).getByRole('button', { name: 'Merge with next' }).click();
    await expect(cues).toHaveCount(n0);
    // delete the last cue, undo, redo
    await cues.nth(n0 - 1).getByRole('button', { name: 'Delete' }).click();
    await expect(cues).toHaveCount(n0 - 1);
    await page.keyboard.press('Control+z');
    await expect(cues).toHaveCount(n0);
    await page.keyboard.press('Control+Shift+z');
    await expect(cues).toHaveCount(n0 - 1);

    const { parseSrt } = await loadSrt();
    const srt = parseSrt(readText(await saveFrom(page, 'download-srt', info.outputPath('out'))));
    expect(srt).toHaveLength(n0 - 1);
    expect(srt[0].text).toBe('Edited first cue');
    expect(srt[0].start).toBeCloseTo(MOCK_CHUNKS[0].timestamp[0] + 0.1, 3);
    expect(srt[1].text.replace(/\s+/g, ' ')).toBe(MOCK_CHUNKS[1].text);
  });

  test('E31 Delete downloaded models empties the model cache @subs', async ({ page }) => {
    await page.goto('/privacy');
    await page.evaluate(async () => {
      const c = await caches.open('transformers-cache');
      await c.put('/models/fake/model.onnx', new Response('x'));
    });
    await page.getByRole('button', { name: 'Delete downloaded models' }).click();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          let total = 0;
          for (const name of await caches.keys()) {
            if (/transformers|model/i.test(name)) total += (await (await caches.open(name)).keys()).length;
          }
          return total;
        }),
      )
      .toBe(0);
  });
});
