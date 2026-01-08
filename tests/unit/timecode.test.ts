// U1 timecode: src/engine/timecode.ts (PURE)
// API: parse(text: string): number (seconds); format(seconds: number): string ("hh:mm:ss.mmm");
//      snapToFrame(seconds: number, fps: number): number (nearest frame boundary, in seconds).
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/engine/timecode');

describe('U1 timecode', () => {
  it('parses hh:mm:ss.mmm', async () => {
    const { parse } = await load();
    expect(parse('1:02:03.450')).toBeCloseTo(3723.45, 6);
  });

  it('parses mm:ss', async () => {
    const { parse } = await load();
    expect(parse('02:03')).toBe(123);
  });

  it('parses plain seconds', async () => {
    const { parse } = await load();
    expect(parse('12.5')).toBe(12.5);
  });

  it.each(['', 'abc', '1:2:3:4', '-5', '01:60', '1:xx'])('throws on invalid input %j', async (bad) => {
    const { parse } = await load();
    expect(() => parse(bad)).toThrow();
  });

  it('formats seconds as hh:mm:ss.mmm', async () => {
    const { format } = await load();
    expect(format(3723.45)).toBe('01:02:03.450');
    expect(format(0)).toBe('00:00:00.000');
  });

  it('round-trips format -> parse', async () => {
    const { parse, format } = await load();
    expect(parse(format(3723.45))).toBeCloseTo(3723.45, 6);
  });

  it('snaps to the nearest frame at 30 fps', async () => {
    const { snapToFrame } = await load();
    // 1.01 s is 30.3 frames -> frame 30 -> 1.0 s
    expect(snapToFrame(1.01, 30)).toBeCloseTo(1.0, 9);
    // 1.02 s is 30.6 frames -> frame 31 -> 31/30 s
    expect(snapToFrame(1.02, 30)).toBeCloseTo(31 / 30, 9);
    expect(snapToFrame(0, 30)).toBe(0);
  });
});
