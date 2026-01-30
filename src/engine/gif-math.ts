// PURE GIF math: frame count and a live size estimate.

export function gifFrameCount(durationSec: number, fps: number): number {
  return Math.max(1, Math.round(durationSec * fps + 1e-9));
}

export interface GifEstimateInput {
  width: number;
  height: number;
  fps: number;
  durationSec: number;
}

/** Rough output size: LZW on palettised natural video averages about 0.35 bytes per pixel per frame. */
export function estimateGifBytes({ width, height, fps, durationSec }: GifEstimateInput): number {
  const frames = gifFrameCount(durationSec, fps);
  return Math.round(800 + frames * (width * height * 0.35 + 800));
}
