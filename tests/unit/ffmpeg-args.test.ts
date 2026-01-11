// U13 ffmpeg args (every WS2 op): src/engine/ffmpeg/args.ts (PURE)
// API: buildFfmpegArgs(job, io: { input: string; output: string }): string[]
// Job shapes (src/engine/types.ts):
//   { op: 'compress', video: { codec, bitrate, width?, height? }, audio: { codec, bitrate } }
//   { op: 'convert', container, video: { codec }, audio: { codec } }
//   { op: 'trim', start, end, mode: 'exact' | 'fast' }
//   { op: 'cut', keep: Array<[start, end]> }
//   { op: 'gif', start, end, fps, width, loop }
//   { op: 'extract-audio', format: 'mp3' | 'm4a' | 'wav' | 'opus', bitrate? }
//   { op: 'resize', aspect, mode: 'crop' | 'fit-pad' | 'fit-blur', inputWidth, inputHeight }
//   { op: 'audio-cut', start, end, fadeIn, fadeOut, format }
//   { op: 'audio-convert', format: 'mp3' | 'm4a' | 'wav' | 'opus' | 'flac', bitrate? }
// Decision 2 (WS0): ffmpeg is an LGPL build, so no argv may name a GPL encoder (libx264 / libx265).
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/engine/ffmpeg/args');

const IO = { input: '/in/clip.mp4', output: 'clip-framelab.out' };

const jobs = {
  compress: { op: 'compress', video: { codec: 'avc', bitrate: 2_000_000 }, audio: { codec: 'aac', bitrate: 128_000 } },
  'convert-webm': { op: 'convert', container: 'webm', video: { codec: 'vp9' }, audio: { codec: 'opus' } },
  'convert-mp4': { op: 'convert', container: 'mp4', video: { codec: 'avc' }, audio: { codec: 'aac' } },
  'trim-exact': { op: 'trim', start: 1, end: 3, mode: 'exact' },
  'trim-fast': { op: 'trim', start: 1, end: 3, mode: 'fast' },
  cut: { op: 'cut', keep: [[0, 1], [2, 5]] },
  gif: { op: 'gif', start: 0, end: 2, fps: 10, width: 320, loop: true },
  'extract-mp3': { op: 'extract-audio', format: 'mp3', bitrate: 192_000 },
  'extract-m4a': { op: 'extract-audio', format: 'm4a' },
  'extract-wav': { op: 'extract-audio', format: 'wav' },
  'extract-opus': { op: 'extract-audio', format: 'opus' },
  'resize-crop': { op: 'resize', aspect: '9:16', mode: 'crop', inputWidth: 1920, inputHeight: 1080 },
  'resize-pad': { op: 'resize', aspect: '9:16', mode: 'fit-pad', inputWidth: 1920, inputHeight: 1080 },
  'resize-blur': { op: 'resize', aspect: '9:16', mode: 'fit-blur', inputWidth: 1920, inputHeight: 1080 },
  'audio-cut': { op: 'audio-cut', start: 2, end: 5, fadeIn: 1, fadeOut: 1, format: 'mp3' },
  'audio-convert-flac': { op: 'audio-convert', format: 'flac' },
  'audio-convert-mp3': { op: 'audio-convert', format: 'mp3', bitrate: 192_000 },
} as const;

const joined = (a: string[]) => a.join(' ');
const valueAfter = (a: string[], flag: string) => a[a.indexOf(flag) + 1];

describe('U13 ffmpeg argument builders', () => {
  it.each(Object.entries(jobs))('%s: starts with the input, ends with the output, matches snapshot', async (name, job) => {
    const { buildFfmpegArgs } = await load();
    const args: string[] = buildFfmpegArgs(job, IO);
    expect(args).toContain('-i');
    expect(valueAfter(args, '-i')).toBe(IO.input);
    expect(args[args.length - 1]).toBe(IO.output);
    expect(args.every((a) => typeof a === 'string' && a.length > 0)).toBe(true);
    expect(args).toMatchSnapshot(name);
  });

  it.each(Object.entries(jobs))('%s: names no GPL encoder (LGPL build)', async (_name, job) => {
    const { buildFfmpegArgs } = await load();
    const text = joined(buildFfmpegArgs(job, IO));
    expect(text).not.toMatch(/libx264|libx265|libxvid|libfdk/);
  });

  it('compress sets the video and audio bitrates', async () => {
    const { buildFfmpegArgs } = await load();
    const a = buildFfmpegArgs(jobs.compress, IO);
    expect(valueAfter(a, '-b:v')).toMatch(/^(2000000|2000k|2M)$/);
    expect(valueAfter(a, '-b:a')).toMatch(/^(128000|128k)$/);
  });

  it('convert to webm uses VP9 and Opus', async () => {
    const { buildFfmpegArgs } = await load();
    const a = buildFfmpegArgs(jobs['convert-webm'], IO);
    expect(valueAfter(a, '-c:v')).toBe('libvpx-vp9');
    expect(valueAfter(a, '-c:a')).toBe('libopus');
  });

  it('trim fast puts -ss before -i and copies streams', async () => {
    const { buildFfmpegArgs } = await load();
    const a = buildFfmpegArgs(jobs['trim-fast'], IO);
    expect(a.indexOf('-ss')).toBeGreaterThanOrEqual(0);
    expect(a.indexOf('-ss')).toBeLessThan(a.indexOf('-i'));
    expect(joined(a)).toContain('-c copy');
  });

  it('trim exact puts -ss after -i and re-encodes', async () => {
    const { buildFfmpegArgs } = await load();
    const a = buildFfmpegArgs(jobs['trim-exact'], IO);
    expect(a.indexOf('-ss')).toBeGreaterThan(a.indexOf('-i'));
    expect(joined(a)).not.toContain('-c copy');
    // duration 2 s expressed as -t 2 or -to 3
    expect(joined(a)).toMatch(/-t 2(\.0+)?\b|-to 3(\.0+)?\b/);
  });

  it('cut uses a filter graph (select/aselect or trim+concat)', async () => {
    const { buildFfmpegArgs } = await load();
    const text = joined(buildFfmpegArgs(jobs.cut, IO));
    expect(text).toContain('-filter_complex');
    expect(text).toMatch(/select=|concat=/);
    expect(text).toMatch(/aselect=|atrim=|concat=.*a=1/);
  });

  it('gif uses palettegen and paletteuse at the chosen fps and width', async () => {
    const { buildFfmpegArgs } = await load();
    const text = joined(buildFfmpegArgs(jobs.gif, IO));
    expect(text).toContain('palettegen');
    expect(text).toContain('paletteuse');
    expect(text).toMatch(/fps=10/);
    expect(text).toMatch(/scale=320:/);
    expect(text).toMatch(/-loop 0/);
  });

  it('extract-audio drops video and picks the codec per format', async () => {
    const { buildFfmpegArgs } = await load();
    const expected = { 'extract-mp3': 'libmp3lame', 'extract-m4a': 'aac', 'extract-wav': 'pcm_s16le', 'extract-opus': 'libopus' } as const;
    for (const [name, codec] of Object.entries(expected)) {
      const a = buildFfmpegArgs(jobs[name as keyof typeof expected], IO);
      expect(a, name).toContain('-vn');
      expect(valueAfter(a, '-c:a'), name).toBe(codec);
    }
  });

  it('resize modes use crop, pad and boxblur filters', async () => {
    const { buildFfmpegArgs } = await load();
    expect(joined(buildFfmpegArgs(jobs['resize-crop'], IO))).toMatch(/crop=(606|608):1080/);
    expect(joined(buildFfmpegArgs(jobs['resize-pad'], IO))).toMatch(/pad=1080:1920/);
    expect(joined(buildFfmpegArgs(jobs['resize-blur'], IO))).toContain('boxblur');
  });

  it('audio-cut uses atrim and afade in and out', async () => {
    const { buildFfmpegArgs } = await load();
    const text = joined(buildFfmpegArgs(jobs['audio-cut'], IO));
    expect(text).toMatch(/atrim=(start=)?2(\.0+)?[:=]/);
    expect(text).toMatch(/afade=t=in/);
    expect(text).toMatch(/afade=t=out/);
  });

  it('audio-convert to flac uses the flac encoder; mp3 sets the bitrate', async () => {
    const { buildFfmpegArgs } = await load();
    expect(valueAfter(buildFfmpegArgs(jobs['audio-convert-flac'], IO), '-c:a')).toBe('flac');
    const mp3 = buildFfmpegArgs(jobs['audio-convert-mp3'], IO);
    expect(valueAfter(mp3, '-c:a')).toBe('libmp3lame');
    expect(valueAfter(mp3, '-b:a')).toMatch(/^(192000|192k)$/);
  });
});
