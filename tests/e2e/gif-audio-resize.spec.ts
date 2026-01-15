// E15 gif: 2 s range at 10 fps, width 320 -> GIF89a, 20 +- 1 frames, width 320.
// E16 extract audio: MP3 audio-only, duration +-0.1 s, MP3 codec; also WAV and M4A.
// E17 resize 9:16 crop: 1080p in -> 606 or 608 x 1080 out; fit-blur gives a 9:16 output.
import { test, expect } from '@playwright/test';
import { FIXTURES } from '../helpers/fixtures';
import { loadFile, openTool, runAndDownload } from '../helpers/app';
import { fill, radio, selectByLabel, setRange } from '../helpers/ops';
import { probe, probeGif } from '../helpers/probe';

test('E15 video to GIF: 2 s at 10 fps and 320 px wide', async ({ page }, info) => {
  await openTool(page, 'video-to-gif');
  await loadFile(page, FIXTURES.h264);
  await setRange(page, 0, 2);
  await fill(page, 'Frame rate (fps)', 10);
  await fill(page, 'Width (px)', 320);
  const g = probeGif(await runAndDownload(page, info.outputPath('out')));
  expect(g.magic).toBe('GIF89a');
  expect(g.width).toBe(320);
  expect(g.height).toBe(180);
  expect(Math.abs(g.frames - 20)).toBeLessThanOrEqual(1);
});

const audioFormats = [
  { format: 'MP3', codec: 'mp3', ext: /\.mp3$/ },
  { format: 'WAV', codec: 'pcm-s16', ext: /\.wav$/ },
  { format: 'M4A', codec: 'aac', ext: /\.m4a$/ },
] as const;

for (const f of audioFormats) {
  test(`E16 extract audio as ${f.format}`, async ({ page }, info) => {
    await openTool(page, 'extract-audio');
    await loadFile(page, FIXTURES.h264);
    await selectByLabel(page, 'Format', f.format);
    const out = await runAndDownload(page, info.outputPath('out'));
    expect(out).toMatch(f.ext);
    const p = await probe(out);
    expect(p.videoTracks).toBe(0);
    expect(p.audioTracks).toBe(1);
    expect(p.audioCodec).toBe(f.codec);
    expect(Math.abs(p.duration - 5)).toBeLessThanOrEqual(0.1);
  });
}

test('E16 video-to-mp3 preselects MP3', async ({ page }) => {
  await openTool(page, 'video-to-mp3');
  await expect(page.getByLabel('Format', { exact: true })).toHaveValue(/mp3/i);
});

test('E17 9:16 crop of the 1080p fixture is 606 or 608 x 1080', async ({ page }, info) => {
  await openTool(page, 'resize-video');
  await loadFile(page, FIXTURES.hd1080);
  await selectByLabel(page, 'Aspect ratio', '9:16');
  await radio(page, 'Crop');
  const p = await probe(await runAndDownload(page, info.outputPath('out')));
  expect([606, 608]).toContain(p.width);
  expect(p.height).toBe(1080);
  expect(Math.abs(p.duration - 4)).toBeLessThanOrEqual(0.1);
});

test('E17 9:16 fit-with-blur gives a 9:16 output', async ({ page }, info) => {
  await openTool(page, 'crop-video');
  await loadFile(page, FIXTURES.hd1080);
  await selectByLabel(page, 'Aspect ratio', '9:16');
  await radio(page, 'Fit with blur');
  const p = await probe(await runAndDownload(page, info.outputPath('out')));
  expect(Math.abs(p.width! / p.height! - 9 / 16)).toBeLessThanOrEqual(0.01);
  expect(p.width! % 2).toBe(0);
  expect(p.height! % 2).toBe(0);
});
