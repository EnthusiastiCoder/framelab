// Decodes media inside the browser under test (msedge has H.264/AAC), so pixel and audio checks need no
// native tools. The file bytes are passed in as base64; outputs in these tests are small.
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Region {
  x: number; // fractions of the frame, 0..1
  y: number;
  w: number;
  h: number;
}

/** Grabs the frame at time t and returns RGBA bytes for each region, plus the frame size. */
export async function framePixels(
  page: Page,
  path: string,
  mime: string,
  t: number,
  regions: Region[],
): Promise<{ width: number; height: number; regions: number[][] }> {
  const b64 = readFileSync(path).toString('base64');
  return page.evaluate(
    async ({ b64, mime, t, regions }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      const v = document.createElement('video');
      v.muted = true;
      v.src = url;
      await new Promise<void>((ok, bad) => {
        v.onloadeddata = () => ok();
        v.onerror = () => bad(new Error('video failed to load'));
      });
      await new Promise<void>((ok) => {
        v.onseeked = () => ok();
        v.currentTime = t;
      });
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(v, 0, 0);
      const out = regions.map((r) => {
        const x = Math.floor(r.x * c.width);
        const y = Math.floor(r.y * c.height);
        const w = Math.max(1, Math.floor(r.w * c.width));
        const h = Math.max(1, Math.floor(r.h * c.height));
        return Array.from(ctx.getImageData(x, y, w, h).data);
      });
      URL.revokeObjectURL(url);
      return { width: c.width, height: c.height, regions: out };
    },
    { b64, mime, t, regions },
  );
}

export function meanAbsDiff(a: number[], b: number[]): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (i % 4 === 3) continue; // alpha
    sum += Math.abs(a[i] - b[i]);
    n++;
  }
  return n ? sum / n : Infinity;
}

/** Fraction of pixels whose R, G and B are all above `threshold` (caption text is white). */
export function brightFraction(rgba: number[], threshold = 200): number {
  let bright = 0;
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    total++;
    if (rgba[i] > threshold && rgba[i + 1] > threshold && rgba[i + 2] > threshold) bright++;
  }
  return total ? bright / total : 0;
}

/** Decodes audio with OfflineAudioContext in the page. Returns duration and the first `n` mono samples. */
export async function decodeAudio(
  page: Page,
  path: string,
  n: number,
): Promise<{ duration: number; sampleRate: number; channels: number; head: number[] }> {
  const b64 = readFileSync(path).toString('base64');
  return page.evaluate(
    async ({ b64, n }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const ctx = new OfflineAudioContext(1, 1, 44100);
      const buf = await ctx.decodeAudioData(bytes.buffer);
      const ch0 = buf.getChannelData(0);
      return {
        duration: buf.duration,
        sampleRate: buf.sampleRate,
        channels: buf.numberOfChannels,
        head: Array.from(ch0.subarray(0, Math.min(n, ch0.length))),
      };
    },
    { b64, n },
  );
}

export function rms(samples: number[]): number {
  if (samples.length === 0) return 0;
  return Math.sqrt(samples.reduce((s, x) => s + x * x, 0) / samples.length);
}
