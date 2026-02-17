// Burn-in (runs in the engine worker): one mediabunny Conversion whose video `process` hook draws the active cue
// on each frame. The audio is copied when it already fits the output (no re-encode), so any input sample rate
// works. Layout comes from style.ts, so what the unit tests measure is what gets drawn.

import { BufferTarget, Conversion, Output, QUALITY_VERY_HIGH, VideoSample, type AudioCodec, type VideoCodec } from 'mediabunny';
import { EngineError, type BurnJob, type Result } from '../engine/types';
import { MIME, outputFilename } from '../engine/output';
import { openInput } from '../engine/mediabunny/probe';
import { abortableDelay, cancelled, outputFormatFor, type RunOptions } from '../engine/mediabunny/convert';
import { ensureEncoder } from '../engine/mediabunny/encoders';
import type { Cue } from './cue';
import { CAPTION_FONT_FAMILY, layoutCaption, type CaptionStyle } from './style';

type Ctx = OffscreenCanvasRenderingContext2D;

/** The cue shown at time t (seconds), if any. */
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
  const { box, lines, fontPx, lineHeightPx } = layoutCaption({ text, frameWidth: width, frameHeight: height, style, measure });
  ctx.save();
  ctx.fillStyle = style.boxColor;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, Math.min(fontPx * 0.25, box.height / 2));
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

/** BT.601 (SMPTE 170M), limited range: what players assume for untagged standard-definition video. */
export const BT601: VideoColorSpaceInit = { primaries: 'smpte170m', transfer: 'smpte170m', matrix: 'smpte170m', fullRange: false };

/**
 * The colour space to tag pass-through frames with, or null to keep them as decoded. An untagged SD input is
 * BT.601 by convention, but the encoder would label the re-encoded stream BT.709, which shifts every colour on
 * playback; re-tagging the frames keeps the output looking like the input.
 */
export function retagFor(colorSpace: VideoColorSpaceInit, height: number): VideoColorSpaceInit | null {
  return !colorSpace.matrix && height > 0 && height < 720 ? BT601 : null;
}

async function retag(sample: VideoSample, colorSpace: VideoColorSpaceInit): Promise<VideoSample> {
  const format = sample.format;
  if (!format) return sample;
  const buf = new Uint8Array(sample.allocationSize());
  const layout = await sample.copyTo(buf);
  const frame = new VideoFrame(buf, {
    format: format as VideoPixelFormat,
    codedWidth: sample.codedWidth,
    codedHeight: sample.codedHeight,
    layout,
    timestamp: sample.microsecondTimestamp,
    duration: sample.microsecondDuration,
    colorSpace,
  });
  return new VideoSample(frame, { timestamp: sample.timestamp, duration: sample.duration });
}

/** The Conversion `process` hook: frames without a cue pass through; frames with one get it drawn on. */
export function captionProcess(cues: Cue[], style: CaptionStyle, tag: VideoColorSpaceInit | null = null) {
  const sorted = cues.filter((c) => c.end > c.start && c.text.trim()).sort((a, b) => a.start - b.start);
  let canvas: OffscreenCanvas | null = null;
  let ctx: Ctx | null = null;
  return async (sample: VideoSample): Promise<VideoSample> => {
    const cue = activeCue(sorted, sample.timestamp + sample.duration / 2);
    if (!cue) return tag ? retag(sample, tag) : sample;
    const w = sample.displayWidth;
    const h = sample.displayHeight;
    if (!canvas || canvas.width !== w || canvas.height !== h) {
      canvas = new OffscreenCanvas(w, h);
      ctx = canvas.getContext('2d');
    }
    if (!ctx) throw new EngineError('UNSUPPORTED_BROWSER', 'This browser cannot draw subtitles onto video frames.');
    ctx.clearRect(0, 0, w, h);
    sample.drawWithFit(ctx, { fit: 'fill' });
    drawCaption(ctx, cue.text, w, h, style);
    return new VideoSample(canvas, { timestamp: sample.timestamp, duration: sample.duration });
  };
}

/** Burns the cues into the whole video. */
export async function burnSubtitles(file: File, job: BurnJob, opts: RunOptions = {}): Promise<Result> {
  const { onProgress, signal, slowMs } = opts;
  if (slowMs && slowMs > 0) {
    await abortableDelay(slowMs, signal, (r) => onProgress?.({ phase: 'reading', ratio: r * 0.1 }));
  }
  if (signal?.aborted) throw cancelled();
  const { videoCodec, audioCodec } = job.output;
  if (!videoCodec) throw new EngineError('UNSUPPORTED_OUTPUT', 'Subtitles can only be burned into a video.');
  await ensureEncoder(audioCodec);

  const input = openInput(file);
  try {
    try {
      await input.getFormat();
    } catch {
      throw new EngineError('CORRUPT_INPUT', 'This file is not a video Framelab can read.');
    }
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new EngineError('UNSUPPORTED_INPUT', 'Subtitles can only be burned into a video.');
    const tag = retagFor(await track.getColorSpace().catch(() => ({})), track.displayHeight);
    const { format, ext } = outputFormatFor(job.output.container);
    const target = new BufferTarget();
    const output = new Output({ format, target });
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        codec: videoCodec as VideoCodec,
        forceTranscode: true,
        // Rotate the pixels before the hook, so captions are drawn upright on what the viewer sees.
        allowTransformationMetadata: false,
        bitrate: job.videoBitrate ?? QUALITY_VERY_HIGH,
        process: captionProcess(job.cues, job.style, tag),
      },
      audio: audioCodec ? { codec: audioCodec as AudioCodec } : { discard: true },
      showWarnings: false,
    });
    const lostVideo = !conversion.utilizedTracks.some((t) => t.type === 'video');
    if (!conversion.isValid || lostVideo) {
      const why = conversion.discardedTracks.map((t) => `${t.track.type}: ${t.reason.replace(/_/g, ' ')}`).join('; ');
      throw new EngineError('UNSUPPORTED_OUTPUT', `This video cannot be written as ${ext.toUpperCase()} here (${why || 'no usable track'}).`);
    }
    onProgress?.({ phase: 'processing', ratio: 0.05 });
    conversion.onProgress = (p) => onProgress?.({ phase: 'processing', ratio: 0.05 + 0.9 * p });
    const onAbort = () => void conversion.cancel();
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      await conversion.execute();
    } catch (err) {
      if (signal?.aborted || (err as Error)?.name === 'ConversionCanceledError') throw cancelled();
      throw err;
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
    if (!target.buffer) throw new EngineError('INTERNAL', 'The output was empty.');
    onProgress?.({ phase: 'done', ratio: 1 });
    const mimeType = MIME[ext] ?? 'application/octet-stream';
    const blob = new Blob([target.buffer], { type: mimeType });
    return { blob, filename: outputFilename(file.name, ext), mimeType, size: blob.size };
  } finally {
    input.dispose();
  }
}
