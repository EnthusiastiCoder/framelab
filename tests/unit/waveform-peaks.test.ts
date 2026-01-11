// U16 waveform peaks: src/engine/audio-math.ts (PURE; run inside the worker)
// API: computePeaks(samples: Float32Array, count: number): Float32Array   (max |sample| per bucket, 0..1)
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/engine/audio-math');

function sine(seconds: number, rate: number, freq: number, amp: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / rate);
  return out;
}

describe('U16 waveform peaks', () => {
  it('a 10 s sine gives N peaks at about the amplitude', async () => {
    const { computePeaks } = await load();
    const peaks = computePeaks(sine(10, 44100, 440, 0.8), 500);
    expect(peaks).toHaveLength(500);
    for (const p of peaks) {
      expect(p).toBeGreaterThan(0.75);
      expect(p).toBeLessThanOrEqual(0.8 + 1e-6);
    }
  });

  it('silence gives zeros', async () => {
    const { computePeaks } = await load();
    const peaks = computePeaks(new Float32Array(44100 * 10), 200);
    expect(peaks).toHaveLength(200);
    expect(Array.from(peaks).every((p) => p === 0)).toBe(true);
  });

  it('negative excursions count (uses absolute value)', async () => {
    const { computePeaks } = await load();
    const s = new Float32Array(1000);
    s[10] = -0.9;
    const peaks = computePeaks(s, 10);
    expect(peaks[0]).toBeCloseTo(0.9, 6);
  });
});
