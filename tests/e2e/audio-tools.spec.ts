// E18 audio cutter: tone-10s.mp3 cut 2-5 s with a 1 s fade gives 3.0 +- 0.05 s; the first 10 ms RMS is near 0.
// E19 audio converter: wav->mp3 at 192 kbps; mp3->flac (ffmpeg chosen automatically, chip says Compatibility); ogg->m4a.
import { test, expect } from '@playwright/test';
import { statSync } from 'node:fs';
import { FIXTURES } from '../helpers/fixtures';
import { engineChip, loadFile, openTool, runAndDownload } from '../helpers/app';
import { fill, selectByLabel, setRange } from '../helpers/ops';
import { probe } from '../helpers/probe';
import { decodeAudio, rms } from '../helpers/frames';

test('E18 audio cutter 2-5 s with 1 s fades', async ({ page }, info) => {
  await openTool(page, 'audio-cutter');
  await loadFile(page, FIXTURES.toneMp3);
  await setRange(page, 2, 5);
  await fill(page, 'Fade in (s)', 1);
  await fill(page, 'Fade out (s)', 1);
  const out = await runAndDownload(page, info.outputPath('out'));
  expect(out).toMatch(/\.mp3$/);
  const p = await probe(out);
  expect(Math.abs(p.duration - 3)).toBeLessThanOrEqual(0.05);
  // decodeAudio resamples to 44.1 kHz, so 10 ms = 441 samples.
  const head = await decodeAudio(page, out, 441);
  expect(head.head).toHaveLength(441);
  expect(rms(head.head)).toBeLessThan(0.02);
});

test('E19 wav -> mp3 at 192 kbps', async ({ page }, info) => {
  await openTool(page, 'audio-converter');
  await loadFile(page, FIXTURES.toneWav);
  await selectByLabel(page, 'Format', 'MP3');
  await selectByLabel(page, 'Bitrate (kbps)', '192');
  const out = await runAndDownload(page, info.outputPath('out'));
  const p = await probe(out);
  expect(p.audioCodec).toBe('mp3');
  expect(Math.abs(p.duration - 10)).toBeLessThanOrEqual(0.1);
  const kbps = (statSync(out).size * 8) / p.duration / 1000;
  expect(kbps).toBeGreaterThan(192 * 0.85);
  expect(kbps).toBeLessThan(192 * 1.15);
});

test('E19 mp3 -> flac picks the ffmpeg path automatically', async ({ page }, info) => {
  await openTool(page, 'audio-converter');
  await loadFile(page, FIXTURES.toneMp3);
  await selectByLabel(page, 'Format', 'FLAC');
  expect(await engineChip(page)).toContain('Compatibility');
  const p = await probe(await runAndDownload(page, info.outputPath('out')));
  expect(p.audioCodec).toBe('flac');
  expect(Math.abs(p.duration - 10)).toBeLessThanOrEqual(0.1);
});

test('E19 ogg -> m4a gives AAC', async ({ page }, info) => {
  await openTool(page, 'audio-converter');
  await loadFile(page, FIXTURES.toneOgg);
  await selectByLabel(page, 'Format', 'M4A');
  const p = await probe(await runAndDownload(page, info.outputPath('out')));
  expect(p.audioCodec).toBe('aac');
  expect(Math.abs(p.duration - 10)).toBeLessThanOrEqual(0.1);
});
