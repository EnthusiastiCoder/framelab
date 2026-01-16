// E30 @subs @slow: the real whisper-tiny, fetched once by scripts/fetch-test-model.mjs into tests/.models/
// (mirroring the same-origin URL paths from modelFileUrls, minus the leading "/models/"), is served through
// page.route. Download notice -> download progress -> transcription; >= 70% of the script words appear;
// a second run in the same context requests 0 model files.
// Decision 3 (WS0): the model URLs are same-origin, so the route intercepts /models/** instead of HF hosts.
import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FIXTURES, SPEECH_SCRIPT } from '../helpers/fixtures';
import { loadFile, openTool } from '../helpers/app';
import { recordRequests } from '../helpers/network';
import { readText, saveFrom, waitForEditor } from '../helpers/subtitles';

const MODELS_DIR = fileURLToPath(new URL('../.models/', import.meta.url));
const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

async function chooseTiny(page: Page) {
  const select = page.getByLabel('Model', { exact: true });
  const labels = await select.locator('option').allInnerTexts();
  const tiny = labels.find((l) => /tiny/i.test(l));
  expect(tiny, `model options: ${labels.join(', ')}`).toBeDefined();
  await select.selectOption({ label: tiny! });
}

test('E30 real whisper-tiny transcribes the speech fixture @subs @slow', async ({ page, baseURL }, info) => {
  test.skip(!existsSync(MODELS_DIR), 'run "node scripts/fetch-test-model.mjs" first');
  test.setTimeout(600_000);
  let served = 0;
  await page.context().route('**/models/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/models\//, '');
    const file = MODELS_DIR + decodeURIComponent(path);
    if (!existsSync(file)) return route.fulfill({ status: 404 });
    served++;
    await route.fulfill({ status: 200, body: readFileSync(file) });
  });

  const net = recordRequests(page, baseURL!);
  await openTool(page, 'auto-subtitles');
  await chooseTiny(page);
  await loadFile(page, FIXTURES.speechMp4);
  await page.getByTestId('run').click();
  await page.getByRole('button', { name: 'Download model' }).click();
  await expect(page.getByTestId('model-notice')).toContainText(/\d+(\.\d+)?\s?MB/);
  await page.getByTestId('model-notice').getByRole('button', { name: 'Download' }).click();
  await expect(page.getByTestId('progress')).toBeVisible();
  await waitForEditor(page, 540_000);
  expect(served).toBeGreaterThan(0);
  expect(net.crossOrigin).toEqual([]);

  const { parseSrt } = await import('../../src/subtitles/srt');
  const cues = parseSrt(readText(await saveFrom(page, 'download-srt', info.outputPath('out'))));
  const got = new Set(normalise(cues.map((c: { text: string }) => c.text).join(' ')));
  const want = normalise(SPEECH_SCRIPT);
  const hits = want.filter((w) => got.has(w)).length;
  expect(hits / want.length).toBeGreaterThanOrEqual(0.7);

  // Second run in the same context: served from cache, 0 model requests.
  const before = served;
  const net2 = recordRequests(page, baseURL!);
  await openTool(page, 'auto-subtitles');
  await chooseTiny(page);
  await loadFile(page, FIXTURES.speechMp4);
  await page.getByTestId('run').click();
  // A cached model may still show the notice, but then it must say 0 MB.
  const again = page.getByRole('button', { name: 'Download model' });
  if (await again.waitFor({ timeout: 3_000 }).then(() => true, () => false)) {
    await again.click();
    await expect(page.getByTestId('model-notice')).toContainText(/\b0\s?MB/);
    await page.getByTestId('model-notice').getByRole('button', { name: 'Download' }).click();
  }
  await waitForEditor(page, 540_000);
  expect(served).toBe(before);
  expect(net2.matching(/\/models\//)).toEqual([]);
});
