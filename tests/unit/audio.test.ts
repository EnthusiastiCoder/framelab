// U15 audio: src/engine/audio-math.ts (PURE)
// API: encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array   (16-bit PCM, interleaved)
//      fadeGain(t: number, opts: { duration: number; fadeIn: number; fadeOut: number }): number   (0..1)
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/engine/audio-math');

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

describe('U15 WAV writer', () => {
  it('writes a correct RIFF header for 44.1 kHz stereo 16-bit', async () => {
    const { encodeWav } = await load();
    const frames = 441;
    const left = new Float32Array(frames).fill(0.5);
    const right = new Float32Array(frames).fill(-0.5);
    const wav = encodeWav([left, right], 44100);
    const v = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    const dataBytes = frames * 2 * 2;
    expect(wav.byteLength).toBe(44 + dataBytes);
    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(v.getUint32(4, true)).toBe(36 + dataBytes);
    expect(ascii(wav, 8, 4)).toBe('WAVE');
    expect(ascii(wav, 12, 4)).toBe('fmt ');
    expect(v.getUint32(16, true)).toBe(16); // fmt chunk size
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(2); // channels
    expect(v.getUint32(24, true)).toBe(44100); // sample rate
    expect(v.getUint32(28, true)).toBe(44100 * 2 * 2); // byte rate
    expect(v.getUint16(32, true)).toBe(4); // block align
    expect(v.getUint16(34, true)).toBe(16); // bits per sample
    expect(ascii(wav, 36, 4)).toBe('data');
    expect(v.getUint32(40, true)).toBe(dataBytes);
  });

  it('interleaves samples and scales to 16-bit', async () => {
    const { encodeWav } = await load();
    const wav = encodeWav([new Float32Array([0.5, 1]), new Float32Array([-0.5, -1])], 44100);
    const v = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(Math.abs(v.getInt16(44, true) - 16384)).toBeLessThanOrEqual(1);
    expect(Math.abs(v.getInt16(46, true) + 16384)).toBeLessThanOrEqual(1);
    expect(v.getInt16(48, true)).toBe(32767);
    expect(v.getInt16(50, true)).toBeLessThanOrEqual(-32767);
  });
});

describe('U15 fade gain', () => {
  const opts = { duration: 10, fadeIn: 1, fadeOut: 2 };

  it('is 0 at the start and 1 after the fade-in duration', async () => {
    const { fadeGain } = await load();
    expect(fadeGain(0, opts)).toBe(0);
    expect(fadeGain(0.5, opts)).toBeGreaterThan(0);
    expect(fadeGain(0.5, opts)).toBeLessThan(1);
    expect(fadeGain(1, opts)).toBe(1);
    expect(fadeGain(5, opts)).toBe(1);
  });

  it('fades out to 0 at the end', async () => {
    const { fadeGain } = await load();
    expect(fadeGain(8, opts)).toBe(1);
    expect(fadeGain(9, opts)).toBeGreaterThan(0);
    expect(fadeGain(9, opts)).toBeLessThan(1);
    expect(fadeGain(10, opts)).toBe(0);
  });

  it('is monotonic during the fade-in', async () => {
    const { fadeGain } = await load();
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      const g = fadeGain(t, opts);
      expect(g).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
  });

  it('no fades means gain 1 everywhere', async () => {
    const { fadeGain } = await load();
    expect(fadeGain(0, { duration: 10, fadeIn: 0, fadeOut: 0 })).toBe(1);
    expect(fadeGain(10, { duration: 10, fadeIn: 0, fadeOut: 0 })).toBe(1);
  });
});
