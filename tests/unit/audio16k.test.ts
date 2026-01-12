// U21 audio16k: src/subtitles/audio16k.ts
// API: downmixAndResample(channels: Float32Array[], inputRate: number, outputRate = 16000): Float32Array
//   (the pure in-worker path: mono downmix + windowed-sinc resample)
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/subtitles/audio16k');

function sine(n: number, rate: number, freq: number, amp = 0.5): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / rate);
  return out;
}

function zeroCrossings(s: Float32Array): number {
  let n = 0;
  for (let i = 1; i < s.length; i++) if ((s[i - 1] < 0 && s[i] >= 0) || (s[i - 1] >= 0 && s[i] < 0)) n++;
  return n;
}

describe('U21 audio16k', () => {
  it('1 s of 44.1 kHz stereo sine gives 16000 mono samples at the same frequency', async () => {
    const { downmixAndResample } = await load();
    const left = sine(44100, 44100, 440);
    const right = sine(44100, 44100, 440);
    const out = downmixAndResample([left, right], 44100);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(16000);
    const expected = 880; // 440 Hz -> 2 crossings per period
    expect(Math.abs(zeroCrossings(out) - expected)).toBeLessThanOrEqual(expected * 0.02);
  });

  it('preserves the amplitude of an in-band tone', async () => {
    const { downmixAndResample } = await load();
    const out = downmixAndResample([sine(44100, 44100, 440, 0.5)], 44100);
    let peak = 0;
    for (let i = 1000; i < out.length - 1000; i++) peak = Math.max(peak, Math.abs(out[i]));
    expect(peak).toBeGreaterThan(0.45);
    expect(peak).toBeLessThan(0.55);
  });

  it('downmix averages the channels (opposite phases cancel)', async () => {
    const { downmixAndResample } = await load();
    const a = sine(44100, 44100, 440, 0.5);
    const b = a.map((v) => -v);
    const out = downmixAndResample([a, b], 44100);
    expect(Math.max(...Array.from(out).map(Math.abs))).toBeLessThan(1e-3);
  });

  it('48 kHz input also gives 16000 samples per second', async () => {
    const { downmixAndResample } = await load();
    expect(downmixAndResample([sine(48000, 48000, 440)], 48000).length).toBe(16000);
  });
});
