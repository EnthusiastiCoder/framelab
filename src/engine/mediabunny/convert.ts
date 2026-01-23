// WebCodecs-path jobs built on mediabunny's Conversion. v1 ships mute (a stream copy without the audio track).
// Runs in the worker. Cancellation goes through an AbortSignal and maps to EngineError CANCELLED.

import { BufferTarget, Conversion, Mp4OutputFormat, Output, WebMOutputFormat } from 'mediabunny';
import { EngineError, type Progress, type Result } from '../types';
import { MIME, outputFilename } from '../output';
import { containerFromFormatName, openInput } from './probe';

export interface RunOptions {
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
  /** Test hook: wait this long (abortably, phase 'reading') before converting, so a cancel can be exercised. */
  slowMs?: number;
}

function cancelled(): EngineError {
  return new EngineError('CANCELLED', 'The job was cancelled.');
}

function abortableDelay(ms: number, signal: AbortSignal | undefined, onTick: (ratio: number) => void): Promise<void> {
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
