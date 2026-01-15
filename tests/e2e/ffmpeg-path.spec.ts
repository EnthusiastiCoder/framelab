// E21: every WS2 op passes again with ?engine=ffmpeg (parametrised).
// Decision 2 (WS0): ffmpeg is an LGPL build without libx264, so the convert case targets WebM (VP9/Opus);
// MP4/H.264 through ffmpeg depends on an LGPL-compatible H.264 encoder (e.g. OpenH264) and is not asserted here.
import { test, expect, type Page } from '@playwright/test';
import { statSync } from 'node:fs';
import { FIXTURES, fixture } from '../helpers/fixtures';
import { engineChip, loadFile, openTool, runAndDownload } from '../helpers/app';
import { addRemovedSections, fill, radio, selectByLabel, setRange } from '../helpers/ops';
import { probe, probeGif } from '../helpers/probe';

interface Op {
  name: string;
  slug: string;
  input: string;
  setup: (page: Page) => Promise<void>;
  verify: (out: string) => Promise<void>;
}

const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

const ops: Op[] = [
  {
    name: 'compress (Small)',
    slug: 'compress-video',
    input: FIXTURES.hd1080,
    setup: (p) => radio(p, 'Small'),
    verify: async (out) => {
      expect(statSync(out).size).toBeLessThan(statSync(fixture(FIXTURES.hd1080)).size);
      const r = await probe(out);
      expect([r.width, r.height]).toEqual([1920, 1080]);
    },
  },
  {
    name: 'convert mp4 -> webm',
    slug: 'convert-video',
    input: FIXTURES.h264,
    setup: (p) => selectByLabel(p, 'Output format', 'WebM'),
    verify: async (out) => {
      const r = await probe(out);
      expect(r.videoCodec).toBe('vp9');
      expect(r.audioCodec).toBe('opus');
      near(r.duration, 5, 0.1);
    },
  },
  {
    name: 'trim exact',
    slug: 'trim-video',
    input: FIXTURES.h264,
    setup: async (p) => {
      await radio(p, 'Exact');
      await setRange(p, 1, 3);
    },
    verify: async (out) => near((await probe(out)).duration, 2, 0.034),
  },
  {
    name: 'cut',
    slug: 'cut-video',
    input: FIXTURES.h264,
    setup: (p) => addRemovedSections(p, [[1, 2]]),
    verify: async (out) => near((await probe(out)).duration, 4, 0.07),
  },
  {
    name: 'gif',
    slug: 'video-to-gif',
    input: FIXTURES.h264,
    setup: async (p) => {
      await setRange(p, 0, 2);
      await fill(p, 'Frame rate (fps)', 10);
      await fill(p, 'Width (px)', 320);
    },
    verify: async (out) => {
      const g = probeGif(out);
      expect(g.magic).toBe('GIF89a');
      expect(g.width).toBe(320);
      near(g.frames, 20, 1);
    },
  },
  {
    name: 'extract audio mp3',
    slug: 'extract-audio',
    input: FIXTURES.h264,
    setup: (p) => selectByLabel(p, 'Format', 'MP3'),
    verify: async (out) => {
      const r = await probe(out);
      expect(r.videoTracks).toBe(0);
      expect(r.audioCodec).toBe('mp3');
      near(r.duration, 5, 0.1);
    },
  },
  {
    name: 'resize 9:16 crop',
    slug: 'resize-video',
    input: FIXTURES.hd1080,
    setup: async (p) => {
      await selectByLabel(p, 'Aspect ratio', '9:16');
      await radio(p, 'Crop');
    },
    verify: async (out) => {
      const r = await probe(out);
      expect([606, 608]).toContain(r.width);
      expect(r.height).toBe(1080);
    },
  },
  {
    name: 'audio cutter',
    slug: 'audio-cutter',
    input: FIXTURES.toneMp3,
    setup: async (p) => {
      await setRange(p, 2, 5);
      await fill(p, 'Fade in (s)', 1);
    },
    verify: async (out) => near((await probe(out)).duration, 3, 0.05),
  },
  {
    name: 'audio converter flac',
    slug: 'audio-converter',
    input: FIXTURES.toneWav,
    setup: (p) => selectByLabel(p, 'Format', 'FLAC'),
    verify: async (out) => expect((await probe(out)).audioCodec).toBe('flac'),
  },
];

for (const op of ops) {
  test(`E21 ${op.name} with ?engine=ffmpeg`, async ({ page }, info) => {
    await openTool(page, op.slug, '?engine=ffmpeg');
    await loadFile(page, op.input);
    await op.setup(page);
    expect(await engineChip(page)).toContain('Compatibility (ffmpeg)');
    await op.verify(await runAndDownload(page, info.outputPath('out')));
  });
}
