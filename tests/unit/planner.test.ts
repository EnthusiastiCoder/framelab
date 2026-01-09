// U2 planner: src/engine/planner.ts (PURE)
// API: planPath(job, caps, inputInfo, opts?: { forceFfmpeg?: boolean }) -> { path: 'webcodecs' | 'ffmpeg'; reason: string }
//   job.output: { container, videoCodec?, audioCodec? }   (codec names as in mediabunny: 'avc','vp9','aac','opus','mp3','flac',...)
//   caps: { webCodecs: boolean; canEncode: Record<codec, boolean>; canDecode: Record<codec, boolean> }
//   inputInfo: { container, videoCodec?, audioCodec? }
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/engine/planner');

const chromeCaps = {
  webCodecs: true,
  canEncode: { avc: true, vp9: true, av1: true, aac: true, opus: true, mp3: false, flac: false },
  canDecode: { avc: true, vp9: true, av1: true, aac: true, opus: true, mp3: true, flac: true },
};

// Firefox-like: no AAC encoder.
const firefoxCaps = {
  webCodecs: true,
  canEncode: { avc: true, vp9: true, av1: true, aac: false, opus: true, mp3: false, flac: false },
  canDecode: { avc: true, vp9: true, av1: true, aac: true, opus: true, mp3: true, flac: true },
};

const mp4In = { container: 'mp4', videoCodec: 'avc', audioCodec: 'aac' };
const webmIn = { container: 'webm', videoCodec: 'vp9', audioCodec: 'opus' };

describe('U2 planner', () => {
  it('picks webcodecs when every needed codec is supported', async () => {
    const { planPath } = await load();
    const job = { op: 'convert', output: { container: 'mp4', videoCodec: 'avc', audioCodec: 'aac' } };
    const plan = planPath(job, chromeCaps, webmIn);
    expect(plan.path).toBe('webcodecs');
    expect(typeof plan.reason).toBe('string');
  });

  it('picks ffmpeg when an encoder is missing (AAC on Firefox) and explains why', async () => {
    const { planPath } = await load();
    const job = { op: 'convert', output: { container: 'mp4', videoCodec: 'avc', audioCodec: 'aac' } };
    const plan = planPath(job, firefoxCaps, webmIn);
    expect(plan.path).toBe('ffmpeg');
    expect(plan.reason.length).toBeGreaterThan(0);
    expect(plan.reason.toLowerCase()).toContain('aac');
  });

  it('picks ffmpeg when WebCodecs is missing entirely', async () => {
    const { planPath } = await load();
    const job = { op: 'mute', output: { container: 'mp4', videoCodec: 'avc' } };
    const plan = planPath(job, { webCodecs: false, canEncode: {}, canDecode: {} }, mp4In);
    expect(plan.path).toBe('ffmpeg');
    expect(plan.reason.length).toBeGreaterThan(0);
  });

  it('forceFfmpeg always gives ffmpeg', async () => {
    const { planPath } = await load();
    const job = { op: 'mute', output: { container: 'mp4', videoCodec: 'avc' } };
    const plan = planPath(job, chromeCaps, mp4In, { forceFfmpeg: true });
    expect(plan.path).toBe('ffmpeg');
    expect(plan.reason.length).toBeGreaterThan(0);
  });

  it('picks ffmpeg for FLAC output', async () => {
    const { planPath } = await load();
    const job = { op: 'audio-convert', output: { container: 'flac', audioCodec: 'flac' } };
    const plan = planPath(job, chromeCaps, { container: 'mp3', audioCodec: 'mp3' });
    expect(plan.path).toBe('ffmpeg');
    expect(plan.reason.toLowerCase()).toContain('flac');
  });
});
