// U22 burn layout: src/subtitles/style.ts (PURE; burn.ts draws what this returns)
// API: DEFAULT_STYLE: CaptionStyle   ({ position: 'top' | 'bottom', margin: fraction of frame height, ... })
//      layoutCaption({ text, frameWidth, frameHeight, style, measure })
//        -> { lines: string[]; fontPx: number; box: { x, y, width, height } }
//      measure(text: string, fontPx: number): number   (text width in px; injected so the layout is testable)
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/subtitles/style');

const measure = (s: string, px: number) => s.length * px * 0.55;
const LONG = 'This is a deliberately long caption that cannot possibly fit on a single line of the video frame';

describe('U22 caption layout', () => {
  it('a long cue wraps within the safe width (90% of the frame width)', async () => {
    const { layoutCaption, DEFAULT_STYLE } = await load();
    const l = layoutCaption({ text: LONG, frameWidth: 1280, frameHeight: 720, style: DEFAULT_STYLE, measure });
    expect(l.lines.length).toBeGreaterThan(1);
    for (const line of l.lines) expect(measure(line, l.fontPx)).toBeLessThanOrEqual(0.9 * 1280);
    expect(l.lines.join(' ')).toBe(LONG);
    expect(l.box.width).toBeLessThanOrEqual(1280);
  });

  it('bottom position keeps the box inside the frame with the margin', async () => {
    const { layoutCaption, DEFAULT_STYLE } = await load();
    const style = { ...DEFAULT_STYLE, position: 'bottom' as const };
    const l = layoutCaption({ text: LONG, frameWidth: 1280, frameHeight: 720, style, measure });
    const margin = style.margin * 720;
    expect(l.box.x).toBeGreaterThanOrEqual(0);
    expect(l.box.y).toBeGreaterThanOrEqual(0);
    expect(l.box.x + l.box.width).toBeLessThanOrEqual(1280);
    expect(l.box.y + l.box.height).toBeLessThanOrEqual(720 - margin + 1e-6);
    expect(l.box.y + l.box.height).toBeGreaterThan(720 / 2);
    expect(Math.abs(l.box.x + l.box.width / 2 - 640)).toBeLessThanOrEqual(1);
  });

  it('top position keeps the box in the top half, below the margin', async () => {
    const { layoutCaption, DEFAULT_STYLE } = await load();
    const style = { ...DEFAULT_STYLE, position: 'top' as const };
    const l = layoutCaption({ text: 'Short', frameWidth: 1280, frameHeight: 720, style, measure });
    expect(l.box.y).toBeGreaterThanOrEqual(style.margin * 720 - 1e-6);
    expect(l.box.y + l.box.height).toBeLessThan(720 / 2);
  });

  it('the font size scales with frame height', async () => {
    const { layoutCaption, DEFAULT_STYLE } = await load();
    const small = layoutCaption({ text: 'Hi', frameWidth: 960, frameHeight: 540, style: DEFAULT_STYLE, measure });
    const big = layoutCaption({ text: 'Hi', frameWidth: 1920, frameHeight: 1080, style: DEFAULT_STYLE, measure });
    const ratio = big.fontPx / small.fontPx;
    expect(ratio).toBeGreaterThan(1.9);
    expect(ratio).toBeLessThan(2.1);
  });
});
