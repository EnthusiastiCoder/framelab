// U14 gif: src/engine/gif-math.ts (PURE; used by src/engine/mediabunny/gif.ts and the live size estimate)
// API: gifFrameCount(durationSec: number, fps: number): number
//      estimateGifBytes({ width, height, fps, durationSec }): number
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/engine/gif-math');

describe('U14 gif math', () => {
  it('frame count is round(duration x fps)', async () => {
    const { gifFrameCount } = await load();
    expect(gifFrameCount(2, 10)).toBe(20);
    expect(gifFrameCount(1.26, 10)).toBe(13);
    expect(gifFrameCount(1.24, 10)).toBe(12);
    expect(gifFrameCount(3.5, 30)).toBe(105);
  });

  it('the size estimate grows with width', async () => {
    const { estimateGifBytes } = await load();
    const small = estimateGifBytes({ width: 320, height: 180, fps: 10, durationSec: 2 });
    const big = estimateGifBytes({ width: 640, height: 360, fps: 10, durationSec: 2 });
    expect(small).toBeGreaterThan(0);
    expect(big).toBeGreaterThan(small);
  });

  it('the size estimate grows with fps', async () => {
    const { estimateGifBytes } = await load();
    const slow = estimateGifBytes({ width: 320, height: 180, fps: 5, durationSec: 2 });
    const fast = estimateGifBytes({ width: 320, height: 180, fps: 30, durationSec: 2 });
    expect(fast).toBeGreaterThan(slow);
  });
});
