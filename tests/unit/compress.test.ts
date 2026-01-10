// U10 compress: src/engine/compress.ts (PURE)
// API: videoBitrateForTarget({ targetMB, durationSec, audioBitrate }): number   (video bits per second)
//        formula (targetMB * 1e6 * 8 - audioBitrate * durationSec) / durationSec, minus a 3% container margin;
//        throws when the target cannot even hold the audio.
//      presetBitrate(preset: 'small' | 'balanced' | 'high', height: number): number   (video bits per second)
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/engine/compress');

describe('U10 compress bitrate math', () => {
  it('60 s, 25 MB target, 128 kbps audio gives about 3.2 Mbps video', async () => {
    const { videoBitrateForTarget } = await load();
    const v = videoBitrateForTarget({ targetMB: 25, durationSec: 60, audioBitrate: 128_000 });
    // (25e6*8 - 128000*60)/60 = 3.205 Mbps; with a 3% margin = 3.109 Mbps.
    expect(v).toBeGreaterThan(3_050_000);
    expect(v).toBeLessThan(3_250_000);
  });

  it('applies the 3% container margin (below the raw formula)', async () => {
    const { videoBitrateForTarget } = await load();
    const raw = (25e6 * 8 - 128_000 * 60) / 60;
    const v = videoBitrateForTarget({ targetMB: 25, durationSec: 60, audioBitrate: 128_000 });
    expect(v).toBeLessThan(raw);
    expect(v).toBeCloseTo(raw * 0.97, -4);
  });

  it('throws when the target is smaller than the audio alone', async () => {
    const { videoBitrateForTarget } = await load();
    // 128 kbps * 60 s = 0.96 MB of audio
    expect(() => videoBitrateForTarget({ targetMB: 0.5, durationSec: 60, audioBitrate: 128_000 })).toThrow();
  });

  it('presets are ordered small < balanced < high at each resolution', async () => {
    const { presetBitrate } = await load();
    for (const h of [360, 720, 1080]) {
      expect(presetBitrate('small', h)).toBeLessThan(presetBitrate('balanced', h));
      expect(presetBitrate('balanced', h)).toBeLessThan(presetBitrate('high', h));
    }
  });

  it('presets grow with resolution and stay in a sensible range', async () => {
    const { presetBitrate } = await load();
    for (const p of ['small', 'balanced', 'high'] as const) {
      expect(presetBitrate(p, 360)).toBeLessThan(presetBitrate(p, 720));
      expect(presetBitrate(p, 720)).toBeLessThan(presetBitrate(p, 1080));
    }
    expect(presetBitrate('small', 360)).toBeGreaterThanOrEqual(200_000);
    expect(presetBitrate('high', 1080)).toBeLessThanOrEqual(12_000_000);
  });
});
