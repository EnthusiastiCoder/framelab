// WebCodecs-path jobs built on mediabunny's Conversion: mute (a stream copy without the audio track) and transcode
// (compress, convert, trim, resize/crop, extract audio, audio cutter, audio converter).
// Runs in the worker. Cancellation goes through an AbortSignal and maps to EngineError CANCELLED.

import {
  BufferTarget,
  Conversion,
  FlacOutputFormat,
  Mp3OutputFormat,
  Mp4OutputFormat,
  OggOutputFormat,
  Output,
  QUALITY_HIGH,
  Quality,
  WavOutputFormat,
  WebMOutputFormat,
  type AudioCodec,
  type ConversionAudioOptions,
  type ConversionVideoOptions,
  type OutputFormat,
  type VideoCodec,
  type VideoSample,
} from 'mediabunny';
import { EngineError, type Progress, type Result, type TranscodeJob } from '../types';
import { MIME, outputFilename } from '../output';
import { containerFromFormatName, openInput } from './probe';
import { fadeAudio } from './audio';
import { ensureEncoder } from './encoders';

export interface RunOptions {
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
  /** Test hook: wait this long (abortably, phase 'reading') before converting, so a cancel can be exercised. */
  slowMs?: number;
}

export function cancelled(): EngineError {
  return new EngineError('CANCELLED', 'The job was cancelled.');
}

export function abortableDelay(ms: number, signal: AbortSignal | undefined, onTick: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(cancelled());
    const started = Date.now();
    const timer = setInterval(() => {
      const ratio = Math.min(1, (Date.now() - started) / ms);
      onTick(ratio);
      if (ratio >= 1) {
        clearInterval(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }
    }, 100);
    const onAbort = () => {
      clearInterval(timer);
      reject(cancelled());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Removes every audio track and copies the video stream unchanged. */
export async function mute(file: File, opts: RunOptions = {}): Promise<Result> {
  const { onProgress, signal, slowMs } = opts;
  if (slowMs && slowMs > 0) {
    await abortableDelay(slowMs, signal, (r) => onProgress?.({ phase: 'reading', ratio: r * 0.1 }));
  }
  if (signal?.aborted) throw cancelled();

  const input = openInput(file);
  try {
    let container: string;
    try {
      container = containerFromFormatName((await input.getFormat()).name);
    } catch {
      throw new EngineError('CORRUPT_INPUT', 'This file is not a video Framelab can read.');
    }
    if ((await input.getVideoTracks().catch(() => [])).length === 0) {
      throw new EngineError('UNSUPPORTED_INPUT', 'This file has no video track to keep.');
    }
    const webm = container === 'webm' || container === 'mkv';
    const ext = webm ? 'webm' : 'mp4';
    const target = new BufferTarget();
    const output = new Output({
      format: webm ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target,
    });
    const conversion = await Conversion.init({ input, output, audio: { discard: true }, showWarnings: false });
    if (!conversion.isValid) {
      throw new EngineError('UNSUPPORTED_INPUT', 'This video stream cannot be copied into the output format.');
    }
    onProgress?.({ phase: 'processing', ratio: 0.1 });
    conversion.onProgress = (p) => onProgress?.({ phase: 'processing', ratio: 0.1 + 0.85 * p });
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
    const mimeType = MIME[ext];
    const blob = new Blob([target.buffer], { type: mimeType });
    return { blob, filename: outputFilename(file.name, ext), mimeType, size: blob.size };
  } finally {
    input.dispose();
  }
}

/** The output format and file extension for a planned output container. */
export function outputFormatFor(container: string): { format: OutputFormat; ext: string } {
  switch (container) {
    case 'webm':
      return { format: new WebMOutputFormat(), ext: 'webm' };
    case 'mp3':
      return { format: new Mp3OutputFormat(), ext: 'mp3' };
    case 'wav':
      return { format: new WavOutputFormat(), ext: 'wav' };
    case 'ogg':
      return { format: new OggOutputFormat(), ext: 'ogg' };
    case 'flac':
      return { format: new FlacOutputFormat(), ext: 'flac' };
    case 'm4a':
      return { format: new Mp4OutputFormat({ fastStart: 'in-memory' }), ext: 'm4a' };
    default:
      return { format: new Mp4OutputFormat({ fastStart: 'in-memory' }), ext: 'mp4' };
  }
}

/** A `process` callback that draws a fit layout (letterbox or blurred fill) onto a reused canvas. */
function fitProcess(layout: NonNullable<TranscodeJob['layout']>, blur: boolean) {
  const { output, source: s, dest: d } = layout;
  const canvas = new OffscreenCanvas(output.width, output.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new EngineError('UNSUPPORTED_BROWSER', 'This browser cannot draw video frames off-screen.');
  return (sample: VideoSample) => {
    ctx.filter = 'none';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, output.width, output.height);
    if (blur) {
      // A blurred copy scaled to cover the whole canvas, behind the sharp frame.
      const scale = Math.max(output.width / s.width, output.height / s.height) * 1.1;
      const w = s.width * scale;
      const h = s.height * scale;
      ctx.filter = `blur(${Math.max(8, Math.round(output.width / 40))}px)`;
      sample.draw(ctx, s.x, s.y, s.width, s.height, (output.width - w) / 2, (output.height - h) / 2, w, h);
      ctx.filter = 'none';
    }
    sample.draw(ctx, s.x, s.y, s.width, s.height, d.x, d.y, d.width, d.height);
    return canvas;
  };
}

function videoOptions(job: TranscodeJob): ConversionVideoOptions {
  const { videoCodec } = job.output;
  if (!videoCodec) return { discard: true };
  const opts: ConversionVideoOptions = {
    codec: videoCodec as VideoCodec,
    bitrate: job.videoBitrate
      ? job.constantBitrate
        ? new Quality({ bitrate: job.videoBitrate, bitrateMode: 'constant' })
        : job.videoBitrate
      : QUALITY_HIGH,
    forceTranscode: !!job.forceTranscode,
  };
  const layout = job.layout;
  if (layout) {
    const fills =
      layout.dest.x === 0 &&
      layout.dest.y === 0 &&
      layout.dest.width === layout.output.width &&
      layout.dest.height === layout.output.height;
    if (fills && !job.blur) {
      opts.crop = { left: layout.source.x, top: layout.source.y, width: layout.source.width, height: layout.source.height };
      opts.width = layout.output.width;
      opts.height = layout.output.height;
      opts.fit = 'fill';
    } else {
      opts.process = fitProcess(layout, !!job.blur);
      opts.processedWidth = layout.output.width;
      opts.processedHeight = layout.output.height;
    }
  }
  return opts;
}

function audioOptions(job: TranscodeJob): ConversionAudioOptions {
  const { audioCodec } = job.output;
  if (!audioCodec) return { discard: true };
  const fade = job.fade && (job.fade.fadeIn > 0 || job.fade.fadeOut > 0) ? job.fade : undefined;
  const opts: ConversionAudioOptions = {
    codec: audioCodec as AudioCodec,
    forceTranscode: !!job.forceTranscode || !!fade,
  };
  if (job.audioBitrate) opts.bitrate = job.audioBitrate;
  else if (!audioCodec.startsWith('pcm') && audioCodec !== 'flac') opts.bitrate = QUALITY_HIGH;
  if (fade) {
    const duration = job.trim ? job.trim.end - job.trim.start : Infinity;
    opts.process = (sample) => fadeAudio(sample, fade, 0, duration);
  }
  return opts;
}

/** Runs one mediabunny Conversion for a transcode-style job. */
export async function transcode(file: File, job: TranscodeJob, opts: RunOptions = {}): Promise<Result> {
  const { onProgress, signal, slowMs } = opts;
  if (slowMs && slowMs > 0) {
    await abortableDelay(slowMs, signal, (r) => onProgress?.({ phase: 'reading', ratio: r * 0.1 }));
  }
  if (signal?.aborted) throw cancelled();
  await ensureEncoder(job.output.audioCodec);

  const input = openInput(file);
  try {
    try {
      await input.getFormat();
    } catch {
      throw new EngineError('CORRUPT_INPUT', 'This file is not a video or audio file Framelab can read.');
    }
    const { format, ext } = outputFormatFor(job.output.container);
    const target = new BufferTarget();
    const output = new Output({ format, target });
    const trim = job.trim && job.trim.end > job.trim.start ? { start: job.trim.start, end: job.trim.end } : undefined;
    const conversion = await Conversion.init({
      input,
      output,
      video: videoOptions(job),
      audio: audioOptions(job),
      trim,
      // Fast trim copies packets and snaps to the previous keyframe; exact trim and compress always re-encode.
      copy: job.copyOnly
        ? { mode: 'forced', boundaryPolicy: 'expand', shiftTolerance: Infinity }
        : job.op === 'trim' || job.forceTranscode
          ? false
          : {},
      showWarnings: false,
    });
    if (!conversion.isValid) {
      const why = conversion.discardedTracks.map((t) => `${t.track.type}: ${t.reason.replace(/_/g, ' ')}`).join('; ');
      throw new EngineError('UNSUPPORTED_OUTPUT', `This file cannot be written as ${ext.toUpperCase()} here (${why || 'no usable track'}).`);
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
