// Burn-in (runs in the engine worker): re-encodes the video through cut() with a frame hook that draws the
// active cue on every frame. Layout comes from style.ts, so what the tests measure is what gets drawn.

import { VideoSample } from 'mediabunny';
import { EngineError, type BurnJob, type Result } from '../engine/types';
import { cut, type FrameHook } from '../engine/mediabunny/ranges';
import { probeFile } from '../engine/mediabunny/probe';
import type { RunOptions } from '../engine/mediabunny/convert';
import type { Cue } from './cue';
import { CAPTION_FONT_FAMILY, layoutCaption, type CaptionStyle } from './style';

type Ctx = OffscreenCanvasRenderingContext2D;

/** The cue shown at time t (seconds), if any. Cues are sorted by start. */
export function activeCue(cues: Cue[], t: number): Cue | undefined {
  return cues.find((c) => t >= c.start && t < c.end);
}

const font = (px: number) => `600 ${px}px ${CAPTION_FONT_FAMILY}`;

/** Draws one caption onto a frame-sized context. */
export function drawCaption(ctx: Ctx, text: string, width: number, height: number, style: CaptionStyle) {
  const measure = (s: string, px: number) => {
    ctx.font = font(px);
    return ctx.measureText(s).width;
  };
  const layout = layoutCaption({ text, frameWidth: width, frameHeight: height, style, measure });
  const { box, lines, fontPx, lineHeightPx } = layout;
  ctx.save();
  ctx.fillStyle = style.boxColor;
  const r = Math.min(fontPx * 0.25, box.height / 2);
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, r);
  ctx.fill();
  ctx.font = font(fontPx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const cx = box.x + box.width / 2;
  const top = box.y + (box.height - lines.length * lineHeightPx) / 2;
  lines.forEach((line, i) => {
    const y = top + lineHeightPx * (i + 0.5);
    if (style.outline > 0) {
      ctx.lineWidth = Math.max(1, fontPx * style.outline);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeText(line, cx, y);
    }
    ctx.fillStyle = style.textColor;
    ctx.fillText(line, cx, y);
  });
  ctx.restore();
}

/** A frame hook that redraws each frame upright and paints the cue active at its timestamp. */
export function captionHook(cues: Cue[], style: CaptionStyle): FrameHook {
  const sorted = [...cues].filter((c) => c.end > c.start && c.text.trim()).sort((a, b) => a.start - b.start);
  let canvas: OffscreenCanvas | null = null;
  let ctx: Ctx | null = null;
  return {
    frame(sample) {
      const w = sample.displayWidth;
      const h = sample.displayHeight;
      if (!canvas || canvas.width !== w || canvas.height !== h) {
        canvas = new OffscreenCanvas(w, h);
        ctx = canvas.getContext('2d');
        if (!ctx) throw new EngineError('UNSUPPORTED_BROWSER', 'This browser cannot draw subtitles onto video frames.');
      }
      const c = ctx!;
      const mid = sample.timestamp + sample.duration / 2;
      const cue = activeCue(sorted, mid);
      if (!cue && sample.rotation === 0 && !sample.flip) return sample;
      c.clearRect(0, 0, w, h);
      sample.drawWithFit(c, { fit: 'fill' });
      if (cue) drawCaption(c, cue.text, w, h, style);
      return new VideoSample(canvas!, { timestamp: sample.timestamp, duration: sample.duration });
    },
  };
}

/** Burns the cues into the whole video (audio is kept). */
export async function burnSubtitles(file: File, job: BurnJob, opts: RunOptions = {}): Promise<Result> {
  const info = await probeFile(file);
  if (!info.videoTracks) throw new EngineError('UNSUPPORTED_INPUT', 'Subtitles can only be burned into a video.');
  if (!(info.duration > 0)) throw new EngineError('CORRUPT_INPUT', 'Could not read the length of this video.');
  return cut(
    file,
    { op: 'cut', output: job.output, keep: [[0, info.duration]], videoBitrate: job.videoBitrate },
    opts,
    captionHook(job.cues, job.style),
  );
}
