#!/usr/bin/env node
// Copies large same-origin assets into public/vendor/, splits any file over 24 MiB into parts (Cloudflare Pages
// caps a single file at 25 MiB) and writes public/vendor/manifest.json with sizes, hashes and part lists.
// v1 ships no ffmpeg; the self-hosted Whisper models (WS3) register their sources in VENDOR_SOURCES.
// Importing this module never runs the CLI.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MAX_PART = 24 * 1024 * 1024;

/** Byte ranges that cover `size` with parts of at most `maxPart` bytes. */
export function planChunks(size, maxPart = MAX_PART) {
  if (!(maxPart > 0)) throw new Error('maxPart must be positive');
  if (size <= maxPart) return [{ offset: 0, length: size }];
  const count = Math.ceil(size / maxPart);
  const base = Math.ceil(size / count);
  const plan = [];
  for (let offset = 0; offset < size; offset += base) plan.push({ offset, length: Math.min(base, size - offset) });
  return plan;
}

export function splitBuffer(buf, maxPart = MAX_PART) {
  return planChunks(buf.byteLength, maxPart).map(({ offset, length }) => buf.subarray(offset, offset + length));
}

export function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Assets to vendor: { from: absolute source path, to: path under public/vendor/ }.
 * Empty in v1 (WebCodecs-only, no wasm engine); WS3 adds the Whisper model files here.
 */
export const VENDOR_SOURCES = [];

export function vendor({ sources = VENDOR_SOURCES, outDir } = {}) {
  const root = outDir ?? fileURLToPath(new URL('../public/vendor/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const entries = [];
  for (const { from, to } of sources) {
    if (!existsSync(from)) throw new Error(`vendor source missing: ${from}`);
    const buf = readFileSync(from);
    const target = join(root, to);
    mkdirSync(dirname(target), { recursive: true });
    const chunks = splitBuffer(buf);
    const parts = [];
    if (chunks.length === 1) {
      writeFileSync(target, buf);
      parts.push(`/vendor/${to}`);
    } else {
      chunks.forEach((chunk, i) => {
        writeFileSync(`${target}.part${i}`, chunk);
        parts.push(`/vendor/${to}.part${i}`);
      });
    }
    entries.push({ path: `/vendor/${to}`, name: basename(to), size: buf.byteLength, sha256: sha256Hex(buf), parts });
  }
  writeFileSync(join(root, 'manifest.json'), `${JSON.stringify({ files: entries }, null, 2)}\n`);
  return entries;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const entries = vendor();
  console.log(`vendored ${entries.length} file(s) into public/vendor/`);
}
