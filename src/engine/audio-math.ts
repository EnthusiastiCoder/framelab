// PURE audio helpers: 16-bit PCM WAV writer, fade gain curve and waveform peaks.

/** Interleaved 16-bit PCM WAV from planar float channels (-1..1). */
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const n = channels.length;
  const frames = n ? channels[0].length : 0;
  const dataBytes = frames * n * 2;
  const out = new Uint8Array(44 + dataBytes);
  const v = new DataView(out.buffer);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, n, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * n * 2, true);
  v.setUint16(32, n * 2, true);
  v.setUint16(34, 16, true);
  ascii(36, 'data');
  v.setUint32(40, dataBytes, true);
  let p = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < n; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(p, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true);
      p += 2;
    }
  }
  return out;
}

export interface FadeOptions {
  /** Length of the clip in seconds. */
  duration: number;
  fadeIn: number;
  fadeOut: number;
}

/** Linear fade gain at time t (seconds from the clip start), 0..1. */
export function fadeGain(t: number, { duration, fadeIn, fadeOut }: FadeOptions): number {
  let g = 1;
  if (fadeIn > 0 && t < fadeIn) g = Math.min(g, Math.max(0, t / fadeIn));
  if (fadeOut > 0 && t > duration - fadeOut) g = Math.min(g, Math.max(0, (duration - t) / fadeOut));
  return g;
}

/** Max |sample| per bucket, `count` buckets. */
export function computePeaks(samples: Float32Array, count: number): Float32Array {
  const peaks = new Float32Array(count);
  if (samples.length === 0 || count <= 0) return peaks;
  const per = samples.length / count;
  for (let b = 0; b < count; b++) {
    const start = Math.floor(b * per);
    const end = Math.max(start + 1, Math.floor((b + 1) * per));
    let m = 0;
    for (let i = start; i < end && i < samples.length; i++) {
      const a = Math.abs(samples[i]);
      if (a > m) m = a;
    }
    peaks[b] = m;
  }
  return peaks;
}
