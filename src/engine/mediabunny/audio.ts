// Audio sample helpers for the worker: exact slicing (cut), linear fades (audio cutter) and waveform peaks.

import { AudioSample, AudioSampleSink } from 'mediabunny';
import { computePeaks, fadeGain } from '../audio-math';
import { openInput } from './probe';

/** Planar float copy of `sample`, frames [from, from + count). */
function planes(sample: AudioSample, from = 0, count = sample.numberOfFrames - from): Float32Array[] {
  const out: Float32Array[] = [];
  for (let c = 0; c < sample.numberOfChannels; c++) {
    const plane = new Float32Array(count);
    sample.copyTo(plane, { planeIndex: c, format: 'f32-planar', frameOffset: from, frameCount: count });
    out.push(plane);
  }
  return out;
}

function fromPlanes(data: Float32Array[], sampleRate: number, timestamp: number): AudioSample {
  const frames = data[0]?.length ?? 0;
  const joined = new Float32Array(frames * data.length);
  data.forEach((p, c) => joined.set(p, c * frames));
  return new AudioSample({ data: joined, format: 'f32-planar', numberOfChannels: data.length, sampleRate, timestamp });
}

/**
 * The part of `sample` inside [start, end) (input seconds), re-timed to start at `outStart` + its offset into the
 * range. Returns null when nothing of it is inside.
 */
export function sliceAudio(sample: AudioSample, start: number, end: number, outStart: number): AudioSample | null {
  const rate = sample.sampleRate;
  const first = Math.max(0, Math.round((start - sample.timestamp) * rate));
  const last = Math.min(sample.numberOfFrames, Math.round((end - sample.timestamp) * rate));
  if (last <= first) return null;
  const ts = outStart + Math.max(0, sample.timestamp + first / rate - start);
  return fromPlanes(planes(sample, first, last - first), rate, ts);
}

/** Applies linear fades: `time0` is the output time where the clip starts, `duration` its length. */
export function fadeAudio(sample: AudioSample, fade: { fadeIn: number; fadeOut: number }, time0: number, duration: number): AudioSample {
  const rate = sample.sampleRate;
  const data = planes(sample);
  const t0 = sample.timestamp - time0;
  for (let i = 0; i < (data[0]?.length ?? 0); i++) {
    const g = fadeGain(t0 + i / rate, { duration, fadeIn: fade.fadeIn, fadeOut: fade.fadeOut });
    if (g === 1) continue;
    for (const p of data) p[i] *= g;
  }
  return fromPlanes(data, rate, sample.timestamp);
}

const BLOCK = 64;

/** Peak envelope (0..1, `count` buckets) of the first audio track, downmixed to mono. */
export async function audioPeaks(file: Blob, count: number, signal?: AbortSignal): Promise<Float32Array> {
  const input = openInput(file);
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return new Float32Array(count);
    const chunks: Float32Array[] = [];
    let total = 0;
    for await (const sample of new AudioSampleSink(track).samples()) {
      try {
        if (signal?.aborted) break;
        const data = planes(sample);
        // Downmix and keep only the peak of every BLOCK frames, so a long file stays small in memory.
        const n = sample.numberOfFrames;
        const reduced = new Float32Array(Math.ceil(n / BLOCK));
        for (let i = 0; i < n; i++) {
          let v = 0;
          for (const p of data) v += p[i];
          v = Math.abs(v / data.length);
          const b = (i / BLOCK) | 0;
          if (v > reduced[b]) reduced[b] = v;
        }
        chunks.push(reduced);
        total += reduced.length;
      } finally {
        sample.close();
      }
    }
    const all = new Float32Array(total);
    let at = 0;
    for (const c of chunks) {
      all.set(c, at);
      at += c.length;
    }
    return computePeaks(all, count);
  } finally {
    input.dispose();
  }
}
