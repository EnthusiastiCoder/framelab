// Video to GIF: CanvasSink renders frames at the chosen fps and width, gifenc writes a looping GIF89a.
// One global palette, sampled from 10 frames spread over the range, keeps colours stable from frame to frame.
// Runs in the worker; gifenc is imported lazily so it only loads for GIF jobs.

import { CanvasSink } from 'mediabunny';
import { EngineError, type GifJob, type Result } from '../types';
import { MIME, outputFilename } from '../output';
import { gifFrameCount } from '../gif-math';
import { evenRound } from '../crop';
import { openInput } from './probe';
import { abortableDelay, cancelled, type RunOptions } from './convert';

const PALETTE_SAMPLES = 10;
/** Pixels taken from each palette sample frame (every n-th pixel), to keep quantising fast. */
const SAMPLE_PIXELS = 20_000;

function pixels(canvas: HTMLCanvasElement | OffscreenCanvas, width: number, height: number): Uint8ClampedArray {
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new EngineError('UNSUPPORTED_BROWSER', 'This browser cannot read video frames off-screen.');
  return ctx.getImageData(0, 0, width, height).data;
}

export async function toGif(file: File, job: GifJob, opts: RunOptions = {}): Promise<Result> {
  const { onProgress, signal, slowMs } = opts;
  if (slowMs && slowMs > 0) {
    await abortableDelay(slowMs, signal, (r) => onProgress?.({ phase: 'reading', ratio: r * 0.1 }));
  }
  if (signal?.aborted) throw cancelled();
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

  const input = openInput(file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new EngineError('UNSUPPORTED_INPUT', 'This file has no video track to turn into a GIF.');
    const width = evenRound(Math.min(job.width, track.displayWidth));
    const height = evenRound((track.displayHeight * width) / track.displayWidth);
    const duration = Math.max(0, job.end - job.start);
    if (duration <= 0) throw new EngineError('UNSUPPORTED_INPUT', 'Pick an end time after the start time.');
    const count = gifFrameCount(duration, job.fps);
    const first = (await track.getFirstTimestamp().catch(() => 0)) ?? 0;
    const times = Array.from({ length: count }, (_, i) => Math.max(first, job.start + i / job.fps));
    const sink = new CanvasSink(track, { width, height, fit: 'fill', poolSize: 0 });

    // Palette from up to 10 frames spread over the range.
    const pick = Array.from({ length: Math.min(PALETTE_SAMPLES, count) }, (_, i) =>
      times[Math.floor((i * count) / Math.min(PALETTE_SAMPLES, count))],
    );
    const step = Math.max(1, Math.floor((width * height) / SAMPLE_PIXELS));
    const sampled: number[] = [];
    for await (const wrapped of sink.canvasesAtTimestamps(pick)) {
      if (signal?.aborted) throw cancelled();
      if (!wrapped) continue;
      const data = pixels(wrapped.canvas, width, height);
      for (let p = 0; p < data.length / 4; p += step) sampled.push(data[p * 4], data[p * 4 + 1], data[p * 4 + 2], 255);
    }
    if (sampled.length === 0) throw new EngineError('UNSUPPORTED_INPUT', 'No video frames were found in this range.');
    const palette = quantize(new Uint8ClampedArray(sampled), 256);
    onProgress?.({ phase: 'processing', ratio: 0.1 });

    const gif = GIFEncoder();
    const delay = Math.round(1000 / job.fps);
    let written = 0;
    let last: Uint8Array | null = null;
    for await (const wrapped of sink.canvasesAtTimestamps(times)) {
      if (signal?.aborted) throw cancelled();
      // A missing frame (before the first timestamp) repeats the previous one so the frame count stays exact.
      const index: Uint8Array | null = wrapped ? applyPalette(pixels(wrapped.canvas, width, height), palette) : last;
      if (!index) continue;
      last = index;
      gif.writeFrame(index, width, height, written === 0 ? { palette, delay, repeat: 0 } : { delay });
      written++;
      onProgress?.({ phase: 'processing', ratio: 0.1 + 0.85 * (written / count) });
    }
    gif.finish();
    const bytes = gif.bytes();
    onProgress?.({ phase: 'done', ratio: 1 });
    const blob = new Blob([bytes as BlobPart], { type: MIME.gif });
    return { blob, filename: outputFilename(file.name, 'gif'), mimeType: MIME.gif, size: blob.size };
  } finally {
    input.dispose();
  }
}
