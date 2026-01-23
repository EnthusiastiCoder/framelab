// U8 vendor manifest: scripts/vendor-assets.mjs + src/engine/assets/loader.ts
// API (vendor-assets.mjs, must not run its CLI when imported):
//   planChunks(size: number, maxPart = 24 * 1024 * 1024): Array<{ offset: number; length: number }>
//   splitBuffer(buf: Uint8Array, maxPart?): Uint8Array[]
//   sha256Hex(buf: Uint8Array): string   (lower-case hex)
// (The loader moved from src/engine/ffmpeg/ to src/engine/assets/ when ffmpeg was dropped from v1.)
// API (loader.ts): assembleParts(parts: Array<ArrayBuffer | Uint8Array>, expectedSha256: string): Promise<Blob>
//   rejects when the SHA-256 of the joined bytes does not match.
// The same chunking also serves the self-hosted Whisper model files (decision 3, WS0).
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

const loadVendor = () => import('../../scripts/vendor-assets.mjs');
const loadLoader = () => import('../../src/engine/assets/loader');

const MiB = 1024 * 1024;

function generated(size: number): Uint8Array {
  const buf = new Uint8Array(size);
  let x = 2463534242;
  for (let i = 0; i < size; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    buf[i] = x & 0xff;
  }
  return buf;
}

describe('U8 vendor manifest', () => {
  it('plans 3 parts of at most 24 MiB for a 60 MiB file, covering it exactly', async () => {
    const { planChunks } = await loadVendor();
    const plan: Array<{ offset: number; length: number }> = planChunks(60 * MiB);
    expect(plan).toHaveLength(3);
    for (const p of plan) expect(p.length).toBeLessThanOrEqual(24 * MiB);
    expect(plan[0].offset).toBe(0);
    for (let i = 1; i < plan.length; i++) expect(plan[i].offset).toBe(plan[i - 1].offset + plan[i - 1].length);
    expect(plan.reduce((s, p) => s + p.length, 0)).toBe(60 * MiB);
  });

  it('does not split a file under the cap', async () => {
    const { planChunks } = await loadVendor();
    expect(planChunks(10 * MiB)).toEqual([{ offset: 0, length: 10 * MiB }]);
  });

  it('sha256Hex matches node:crypto', async () => {
    const { sha256Hex } = await loadVendor();
    const buf = generated(1000);
    expect(sha256Hex(buf)).toBe(createHash('sha256').update(buf).digest('hex'));
  });

  it('split then reassemble gives the same SHA-256', async () => {
    const { splitBuffer, sha256Hex } = await loadVendor();
    const { assembleParts } = await loadLoader();
    const buf = generated(60 * MiB);
    const expected = sha256Hex(buf);
    const parts = splitBuffer(buf);
    expect(parts).toHaveLength(3);
    const blob = await assembleParts(parts, expected);
    const joined = new Uint8Array(await blob.arrayBuffer());
    expect(joined.byteLength).toBe(buf.byteLength);
    expect(createHash('sha256').update(joined).digest('hex')).toBe(expected);
  });

  it('reassembly rejects on a hash mismatch', async () => {
    const { splitBuffer } = await loadVendor();
    const { assembleParts } = await loadLoader();
    const parts = splitBuffer(generated(1 * MiB));
    await expect(assembleParts(parts, '0'.repeat(64))).rejects.toThrow();
  });
});
