// E21 (adapted, CTO: v1 is WebCodecs-only, no ffmpeg path exists). The user-facing equivalent of "every WS2 op
// passes again on the fallback engine": with the browser's H.264 and AAC encoders reported as unavailable (as on
// bundled Chromium), every WS2 op still produces a valid output. Every verify assert is unchanged. The chip assert
// becomes: video ops say why they fall back to WebM (engine-reason), MP3/FLAC ops show the Compatibility (WASM
// encoder) chip, and GIF stays on the fast path.
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
  /** What the page must say about the engine: a WebM fallback reason, the WASM chip, or the fast chip. */
  engine: 'webm-reason' | 'compatibility' | 'fast';
  setup: (page: Page) => Promise<void>;
  verify: (out: string) => Promise<void>;
}

/** Makes the page report no H.264 and no AAC encoder, like bundled Chromium. */
function noH264NorAac() {
  const patch = (ctor: any, blocked: RegExp) => {
    if (!ctor?.isConfigSupported) return;
    const original = ctor.isConfigSupported.bind(ctor);
    ctor.isConfigSupported = async (config: { codec: string }) =>
      blocked.test(config.codec) ? { supported: false, config } : original(config);
  };
  patch((window as any).VideoEncoder, /^(avc1|avc3)/);
  patch((window as any).AudioEncoder, /^mp4a/);
}

const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

const ops: Op[] = [
  {
    name: 'compress (Small)',
    engine: 'webm-reason',
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
    engine: 'fast',
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
    engine: 'webm-reason',
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
    engine: 'webm-reason',
    slug: 'cut-video',
    input: FIXTURES.h264,
    setup: (p) => addRemovedSections(p, [[1, 2]]),
    verify: async (out) => near((await probe(out)).duration, 4, 0.07),
  },
  {
    name: 'gif',
    engine: 'fast',
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
    engine: 'compatibility',
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
    engine: 'webm-reason',
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
    engine: 'compatibility',
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
    engine: 'compatibility',
    slug: 'audio-converter',
    input: FIXTURES.toneWav,
    setup: (p) => selectByLabel(p, 'Format', 'FLAC'),
    verify: async (out) => expect((await probe(out)).audioCodec).toBe('flac'),
  },
];

for (const op of ops) {
  test(`E21 ${op.name} without H.264/AAC encoders`, async ({ page }, info) => {
    await page.addInitScript(noH264NorAac);
    await openTool(page, op.slug);
    await loadFile(page, op.input);
    await op.setup(page);
    if (op.engine === 'webm-reason') {
      await expect(page.getByTestId('engine-reason')).toContainText('WebM');
    } else if (op.engine === 'compatibility') {
      expect(await engineChip(page)).toContain('Compatibility');
    } else {
      expect(await engineChip(page)).toContain('Fast (WebCodecs)');
    }
    await op.verify(await runAndDownload(page, info.outputPath('out')));
  });
}
