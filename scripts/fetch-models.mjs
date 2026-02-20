#!/usr/bin/env node
// Mirrors the self-hosted Whisper models (decision 3, WS0) from their pinned upstream revisions into a folder
// that is served at /models/: <out>/<model id>/<revision>/<file>, with any file over 24 MiB split into .partN
// chunks (Cloudflare Pages caps a file at 25 MiB). Sizes and SHA-256 hashes are checked against
// src/subtitles/models.ts. Files already present with the right size are skipped.
//
//   node scripts/fetch-models.mjs                      all models into public/models/ (deploy; ~375 MB)
//   node scripts/fetch-models.mjs whisper-tiny         one model (matches the id suffix)
//   node scripts/fetch-models.mjs --out dir whisper-tiny
//
// This is the only place that names the upstream host; nothing in src/ or dist/ does. Importing this module
// never runs the CLI.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const UPSTREAM = 'https://huggingface.co';

async function registry() {
  return import(pathToFileURL(fileURLToPath(new URL('../src/subtitles/models.ts', import.meta.url))).href);
}

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Local paths of every part of a file, in order. */
function localParts(outDir, model, file, partPlan) {
  const base = join(outDir, ...model.id.split('/'), model.revision, ...file.path.split('/'));
  const plan = partPlan(file.bytes);
  return plan.length === 1 ? [{ path: base, ...plan[0] }] : plan.map((p, i) => ({ path: `${base}.part${i}`, ...p }));
}

async function download(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Fetches the given models into outDir. Returns the number of bytes downloaded. */
export async function fetchModels({ ids = [], outDir, log = console.log } = {}) {
  const { MODELS, partPlan } = await registry();
  const chosen = ids.length ? MODELS.filter((m) => ids.some((id) => m.id === id || m.id.endsWith(`/${id}`))) : MODELS;
  if (ids.length && chosen.length === 0) throw new Error(`no model matches ${ids.join(', ')}`);
  let downloaded = 0;
  for (const model of chosen) {
    log(`${model.id}@${model.revision.slice(0, 8)}: ${model.label}`);
    for (const file of model.files) {
      const parts = localParts(outDir, model, file, partPlan);
      if (parts.every((p) => existsSync(p.path) && statSync(p.path).size === p.length)) {
        log(`  ok    ${file.path}`);
        continue;
      }
      const url = `${UPSTREAM}/${model.id}/resolve/${model.revision}/${file.path}`;
      const buf = await download(url);
      if (buf.byteLength !== file.bytes) throw new Error(`${file.path}: expected ${file.bytes} bytes, got ${buf.byteLength}`);
      if (file.sha256 && sha256Hex(buf) !== file.sha256) throw new Error(`${file.path}: SHA-256 mismatch`);
      for (const p of parts) {
        mkdirSync(dirname(p.path), { recursive: true });
        writeFileSync(p.path, buf.subarray(p.offset, p.offset + p.length));
      }
      downloaded += buf.byteLength;
      log(`  fetch ${file.path} (${(buf.byteLength / 1e6).toFixed(1)} MB${parts.length > 1 ? `, ${parts.length} parts` : ''})`);
    }
  }
  return downloaded;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  let outDir = fileURLToPath(new URL('../public/models/', import.meta.url));
  const ids = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') outDir = args[++i];
    else ids.push(args[i]);
  }
  fetchModels({ ids, outDir }).then(
    (n) => console.log(`fetched ${(n / 1e6).toFixed(1)} MB into ${outDir}`),
    (err) => {
      console.error(String(err?.message ?? err));
      process.exit(1);
    },
  );
}
