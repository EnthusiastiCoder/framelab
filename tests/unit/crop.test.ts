// U11 crop: src/engine/crop.ts (PURE)
// API: layoutFor(src: { width, height }, opts: { aspect: '9:16' | '1:1' | '4:5' | '16:9' | 'free'; mode: 'crop' | 'fit-pad' | 'fit-blur'; rect?: Rect })
//   -> { output: { width, height }; source: Rect; dest: Rect }
//   source = region of the input frame that is used; dest = where it is drawn in the output canvas.
//   Rect = { x, y, width, height }. Every output and rect dimension is even.
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/engine/crop');

const HD = { width: 1920, height: 1080 };
const even = (n: number) => n % 2 === 0;

describe('U11 crop layout', () => {
  it('9:16 crop of 1920x1080 is 606 or 608 wide by 1080, centred', async () => {
    const { layoutFor } = await load();
    const l = layoutFor(HD, { aspect: '9:16', mode: 'crop' });
    expect([606, 608]).toContain(l.output.width);
    expect(l.output.height).toBe(1080);
    expect(l.source.width).toBe(l.output.width);
    expect(l.source.height).toBe(1080);
    expect(l.source.y).toBe(0);
    const centre = l.source.x + l.source.width / 2;
    expect(Math.abs(centre - 960)).toBeLessThanOrEqual(2);
  });

  it('9:16 fit-pad of 1920x1080 is a 1080x1920 canvas with a 1080x608 scaled rect, centred', async () => {
    const { layoutFor } = await load();
    const l = layoutFor(HD, { aspect: '9:16', mode: 'fit-pad' });
    expect(l.output).toEqual({ width: 1080, height: 1920 });
    expect(l.dest.width).toBe(1080);
    expect(l.dest.height).toBe(608);
    expect(l.dest.x).toBe(0);
    expect(Math.abs(l.dest.y + l.dest.height / 2 - 960)).toBeLessThanOrEqual(2);
    expect(l.source).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it('fit-blur uses the same canvas as fit-pad', async () => {
    const { layoutFor } = await load();
    const l = layoutFor(HD, { aspect: '9:16', mode: 'fit-blur' });
    expect(l.output).toEqual({ width: 1080, height: 1920 });
  });

  it.each(['9:16', '1:1', '4:5', '16:9'] as const)('every dimension is even for %s in every mode', async (aspect) => {
    const { layoutFor } = await load();
    for (const src of [HD, { width: 1279, height: 721 }, { width: 360, height: 640 }]) {
      for (const mode of ['crop', 'fit-pad', 'fit-blur'] as const) {
        const l = layoutFor(src, { aspect, mode });
        for (const n of [l.output.width, l.output.height, l.source.width, l.source.height, l.dest.width, l.dest.height]) {
          expect(even(n), `${aspect} ${mode} ${src.width}x${src.height}: ${n}`).toBe(true);
        }
      }
    }
  });

  it('1:1 crop of 1920x1080 is 1080x1080', async () => {
    const { layoutFor } = await load();
    expect(layoutFor(HD, { aspect: '1:1', mode: 'crop' }).output).toEqual({ width: 1080, height: 1080 });
  });

  it('free crop is clamped to the frame bounds', async () => {
    const { layoutFor } = await load();
    const l = layoutFor(HD, { aspect: 'free', mode: 'crop', rect: { x: -50, y: -20, width: 3000, height: 500 } });
    expect(l.source.x).toBeGreaterThanOrEqual(0);
    expect(l.source.y).toBeGreaterThanOrEqual(0);
    expect(l.source.x + l.source.width).toBeLessThanOrEqual(1920);
    expect(l.source.y + l.source.height).toBeLessThanOrEqual(1080);
    expect(even(l.source.width) && even(l.source.height)).toBe(true);
    expect(l.source.width).toBeGreaterThan(0);
    expect(l.source.height).toBeGreaterThan(0);
  });
});
