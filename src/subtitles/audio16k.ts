// Audio for the speech model: mono, 16 kHz, Float32. The resampler is a windowed-sinc low-pass
// (Blackman window, cutoff just below min(in, out) / 2) evaluated from a precomputed kernel table,
// and it streams, so an hour of audio never needs the whole input-rate signal in memory.

export const ASR_SAMPLE_RATE = 16000;

/** Zero crossings of the low-pass kernel kept on each side. */
const ZEROS = 12;
/** Table resolution: kernel samples per input sample. */
const TABLE_RES = 256;
/** Cutoff as a fraction of the lower Nyquist rate (leaves a small transition band). */
const CUTOFF = 0.94;

/** Averages the channels into one mono signal. */
export function downmix(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0].slice();
  const n = Math.min(...channels.map((c) => c.length));
  const out = new Float32Array(n);
  const k = 1 / channels.length;
  for (const c of channels) for (let i = 0; i < n; i++) out[i] += c[i] * k;
  return out;
}

/** A streaming mono resampler: push input blocks, read output blocks, flush at the end. */
export class StreamingResampler {
  private readonly ratio: number; // input samples per output sample
  private readonly fc: number; // cutoff in cycles per input sample
  private readonly half: number; // kernel half-width in input samples
  private readonly table: Float32Array;
  private buf = new Float32Array(0);
  private bufStart = 0; // absolute input index of buf[0]
  private totalIn = 0;
  private nextOut = 0;

  constructor(
    readonly inputRate: number,
    readonly outputRate: number = ASR_SAMPLE_RATE,
  ) {
    this.ratio = inputRate / outputRate;
    this.fc = (CUTOFF * 0.5 * Math.min(inputRate, outputRate)) / inputRate;
    this.half = ZEROS / (2 * this.fc);
    const n = Math.ceil(this.half * TABLE_RES) + 2;
    this.table = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i / TABLE_RES;
      if (x >= this.half) break;
      const arg = 2 * this.fc * x;
      const sinc = arg === 0 ? 1 : Math.sin(Math.PI * arg) / (Math.PI * arg);
      const w = 0.42 + 0.5 * Math.cos((Math.PI * x) / this.half) + 0.08 * Math.cos((2 * Math.PI * x) / this.half);
      this.table[i] = 2 * this.fc * sinc * w;
    }
  }

  private kernel(d: number): number {
    const p = Math.abs(d) * TABLE_RES;
    const i = p | 0;
    const f = p - i;
    return this.table[i] * (1 - f) + this.table[i + 1] * f;
  }

  private sampleAt(t: number): number {
    const lo = Math.max(Math.ceil(t - this.half), 0);
    const hi = Math.min(Math.floor(t + this.half), this.totalIn - 1);
    let acc = 0;
    let wsum = 0;
    for (let k = lo; k <= hi; k++) {
      const w = this.kernel(t - k);
      acc += this.buf[k - this.bufStart] * w;
      wsum += w;
    }
    return wsum > 1e-9 ? acc / wsum : 0;
  }

  /** Appends mono input and returns every output sample whose kernel window is now complete. */
  push(input: Float32Array): Float32Array {
    const joined = new Float32Array(this.buf.length + input.length);
    joined.set(this.buf);
    joined.set(input, this.buf.length);
    this.buf = joined;
    this.totalIn += input.length;
    return this.drain(false);
  }

  /** Returns the remaining output samples (the total is floor(inputSamples * out / in)). */
  flush(): Float32Array {
    return this.drain(true);
  }

  private drain(final: boolean): Float32Array {
    const limit = final
      ? Math.floor((this.totalIn * this.outputRate) / this.inputRate + 1e-9)
      : Math.max(0, Math.floor((this.totalIn - 1 - this.half) / this.ratio) + 1);
    const count = Math.max(0, limit - this.nextOut);
    const out = new Float32Array(count);
    for (let j = 0; j < count; j++) out[j] = this.sampleAt((this.nextOut + j) * this.ratio);
    this.nextOut += count;
    // Drop input that no future output sample can reach.
    const keepFrom = Math.max(this.bufStart, Math.floor(this.nextOut * this.ratio - this.half) - 1);
    if (keepFrom > this.bufStart) {
      this.buf = this.buf.slice(keepFrom - this.bufStart);
      this.bufStart = keepFrom;
    }
    return out;
  }
}

/** Mono downmix plus windowed-sinc resample of a whole signal. */
export function downmixAndResample(channels: Float32Array[], inputRate: number, outputRate = ASR_SAMPLE_RATE): Float32Array {
  const mono = downmix(channels);
  if (inputRate === outputRate) return mono;
  const r = new StreamingResampler(inputRate, outputRate);
  const a = r.push(mono);
  const b = r.flush();
  const out = new Float32Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/** Joins Float32Array blocks into one. */
export function concatFloat32(blocks: Float32Array[]): Float32Array {
  const out = new Float32Array(blocks.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const b of blocks) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}
