// E28 @subs: burn-in with mock cues gives an MP4 within +-0.1 s of the input; the frame mid-cue has bright caption
//            pixels in the bottom-centre region, and a frame outside cue time does not.
// E29 @subs: /burn-subtitles with sample.srt + the h264 fixture gives an output with the captions present.
import { test, expect } from '@playwright/test';
import { FIXTURES, fixture } from '../helpers/fixtures';
import { download, loadFile, openTool } from '../helpers/app';
import { probe } from '../helpers/probe';
import { brightFraction, framePixels, meanAbsDiff, type Region } from '../helpers/frames';
import { MOCK_CHUNKS, waitForEditor } from '../helpers/subtitles';

const BOTTOM_CENTRE: Region = { x: 0.2, y: 0.7, w: 0.6, h: 0.25 };
// sample.srt / MOCK_CHUNKS cue 1 is 0.5-1.8 s; nothing is shown before 0.5 s.
const MID_CUE = (MOCK_CHUNKS[0].timestamp[0] + MOCK_CHUNKS[0].timestamp[1]) / 2;
const NO_CUE = 0.2;

test('E28 burned-in captions appear only during cue time @subs', async ({ page }, info) => {
  await openTool(page, 'auto-subtitles', '?asr=mock');
  await loadFile(page, FIXTURES.speechMp4);
  await page.getByTestId('run').click();
  await waitForEditor(page);
  await page.getByTestId('burn').click();
  const out = await download(page, info.outputPath('out'));
  const [inp, res] = [await probe(fixture(FIXTURES.speechMp4)), await probe(out)];
  expect(res.mimeType).toContain('video/mp4');
  expect(Math.abs(res.duration - inp.duration)).toBeLessThanOrEqual(0.1);
  // speech-en.mp4 is a solid blue background, so any bright pixel is caption text.
  const during = await framePixels(page, out, 'video/mp4', MID_CUE, [BOTTOM_CENTRE]);
  const outside = await framePixels(page, out, 'video/mp4', NO_CUE, [BOTTOM_CENTRE]);
  expect(brightFraction(during.regions[0])).toBeGreaterThan(0.005);
  expect(brightFraction(outside.regions[0])).toBeLessThan(0.0005);
});

test('E29 burn-subtitles with sample.srt draws the captions @subs', async ({ page }, info) => {
  await openTool(page, 'burn-subtitles');
  await loadFile(page, FIXTURES.h264);
  await page.getByTestId('subtitle-file').setInputFiles(fixture(FIXTURES.srt));
  await page.getByTestId('run').click();
  const out = await download(page, info.outputPath('out'));
  expect(Math.abs((await probe(out)).duration - 5)).toBeLessThanOrEqual(0.1);
  // testsrc2 has its own bright areas, so compare against the input frame instead of absolute brightness.
  const src = fixture(FIXTURES.h264);
  const inDuring = await framePixels(page, src, 'video/mp4', MID_CUE, [BOTTOM_CENTRE]);
  const outDuring = await framePixels(page, out, 'video/mp4', MID_CUE, [BOTTOM_CENTRE]);
  const inOutside = await framePixels(page, src, 'video/mp4', NO_CUE, [BOTTOM_CENTRE]);
  const outOutside = await framePixels(page, out, 'video/mp4', NO_CUE, [BOTTOM_CENTRE]);
  expect(meanAbsDiff(inDuring.regions[0], outDuring.regions[0])).toBeGreaterThan(8);
  expect(meanAbsDiff(inOutside.regions[0], outOutside.regions[0])).toBeLessThan(6);
});
