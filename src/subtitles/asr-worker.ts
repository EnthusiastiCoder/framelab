// Speech recognition worker. Runs Whisper (transformers.js + onnxruntime-web, WASM backend) entirely in the
// user's browser. Model files come only from our own origin: a fetch shim maps each whole-file URL under
// /models/ onto its .partN chunks, verifies the size and SHA-256 and reports download progress; transformers.js
// then keeps the files in the Cache API ('transformers-cache'), so a second run makes no model request at all.
// ?asr=mock returns MOCK_CHUNKS without importing transformers.

import { AudioSampleSink, type AudioSample } from 'mediabunny';
import { openInput } from '../engine/mediabunny/probe';
import { ASR_SAMPLE_RATE, StreamingResampler, concatFloat32, downmix } from './audio16k';
import { MOCK_CHUNKS } from './mock';
import { MODEL_BASE, findModel, partUrls, type ModelFile, type WhisperModel } from './models';
import type { AsrChunk } from './segment';
import type { AsrPhase, AsrRequest, AsrResponse } from './asr-protocol';

const scope = self as unknown as {
  postMessage(msg: AsrResponse): void;
  addEventListener(type: 'message', fn: (e: MessageEvent<AsrRequest>) => void): void;
  location: Location;
  fetch: typeof fetch;
  crossOriginIsolated?: boolean;
};

/** Seconds of audio per pipeline call, so progress can be reported between calls. */
const SEGMENT_SECONDS = 300;

const cancelled = new Set<number>();
class Cancelled extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'AbortError';
  }
}

const post = (msg: AsrResponse) => scope.postMessage(msg);

// ---------- audio ----------

function planes(sample: AudioSample): Float32Array[] {
  const out: Float32Array[] = [];
  for (let c = 0; c < sample.numberOfChannels; c++) {
    const plane = new Float32Array(sample.numberOfFrames);
    sample.copyTo(plane, { planeIndex: c, format: 'f32-planar' });
    out.push(plane);
  }
  return out;
}

/** Decodes the first audio track to mono 16 kHz, streaming through the resampler. */
async function decode16k(file: File, onRatio: (r: number) => void, isCancelled: () => boolean): Promise<Float32Array> {
  const input = openInput(file);
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error('This file has no audio track to transcribe.');
    const duration = await input.computeDuration().catch(() => 0);
    let resampler: StreamingResampler | null = null;
    const blocks: Float32Array[] = [];
    for await (const sample of new AudioSampleSink(track).samples()) {
      try {
        if (isCancelled()) throw new Cancelled();
        resampler ??= new StreamingResampler(sample.sampleRate, ASR_SAMPLE_RATE);
        blocks.push(resampler.push(downmix(planes(sample))));
        if (duration > 0) onRatio(Math.min(1, (sample.timestamp + sample.duration) / duration));
      } finally {
        sample.close();
      }
    }
    if (resampler) blocks.push(resampler.flush());
    return concatFloat32(blocks);
  } finally {
    input.dispose();
  }
}

// ---------- same-origin model fetch shim ----------

interface Download {
  model: WhisperModel;
  loaded: Map<string, number>;
  onProgress: (ratio: number) => void;
}
let download: Download | null = null;
const nativeFetch: typeof fetch = scope.fetch.bind(self);

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function lookup(pathname: string): { model: WhisperModel; file: ModelFile } | null {
  const m = download?.model;
  if (!m) return null;
  const prefix = `${MODEL_BASE}${m.id}/${m.revision}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rel = decodeURIComponent(pathname.slice(prefix.length));
  const file = m.files.find((f) => f.path === rel);
  return file ? { model: m, file } : null;
}

async function fetchModelFile(model: WhisperModel, file: ModelFile): Promise<Response> {
  const chunks: Uint8Array[] = [];
  let got = 0;
  const report = () => {
    if (!download) return;
    download.loaded.set(file.path, got);
    let sum = 0;
    for (const v of download.loaded.values()) sum += v;
    download.onProgress(Math.min(1, sum / model.bytes));
  };
  for (const url of partUrls(model, file)) {
    const res = await nativeFetch(url);
    if (!res.ok || !res.body) throw new Error(`Could not download the speech model (${url}: HTTP ${res.status}).`);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.byteLength;
      report();
    }
  }
  if (got !== file.bytes) throw new Error(`The speech model file ${file.path} is incomplete (${got} of ${file.bytes} bytes).`);
  const joined = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) {
    joined.set(c, at);
    at += c.byteLength;
  }
  if (file.sha256) {
    const digest = toHex(await crypto.subtle.digest('SHA-256', joined));
    if (digest !== file.sha256) throw new Error(`The speech model file ${file.path} failed its integrity check.`);
  }
  const type = file.path.endsWith('.json') ? 'application/json' : 'application/octet-stream';
  return new Response(joined, { status: 200, headers: { 'content-type': type, 'content-length': String(got) } });
}

scope.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(href, scope.location.href);
  if (url.origin !== scope.location.origin || !url.pathname.startsWith(MODEL_BASE)) return nativeFetch(input, init);
  const hit = lookup(url.pathname);
  // Anything the model does not list (optional upstream files) is answered here: no request is made.
  if (!hit) return new Response(null, { status: 404, statusText: 'Not Found' });
  return fetchModelFile(hit.model, hit.file);
}) as typeof fetch;

// ---------- transformers.js ----------

type Transcriber = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string; chunks?: AsrChunk[] }>;
let loaded: { id: string; run: Transcriber } | null = null;

async function loadModel(model: WhisperModel, onProgress: (phase: AsrPhase, r: number) => void): Promise<Transcriber> {
  if (loaded?.id === model.id) return loaded.run;
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = true;
  env.remoteHost = `${scope.location.origin}${MODEL_BASE}`;
  env.remotePathTemplate = '{model}/{revision}/';
  const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown; numThreads?: number; proxy?: boolean } };
  if (onnx.wasm) {
    // transformers.js points wasmPaths at a CDN by default. Clearing it makes onnxruntime-web load the
    // runtime .wasm that Vite emits next to this chunk (dist/_astro/), on our own origin.
    onnx.wasm.wasmPaths = undefined;
    onnx.wasm.proxy = false;
    if (!scope.crossOriginIsolated) onnx.wasm.numThreads = 1;
  }
  download = { model, loaded: new Map(), onProgress: (r) => onProgress('download', r) };
  try {
    const asr = await pipeline('automatic-speech-recognition', model.id, {
      revision: model.revision,
      device: 'wasm',
      dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
    } as Record<string, unknown>);
    const run = asr as unknown as Transcriber;
    loaded = { id: model.id, run };
    return run;
  } finally {
    download = null;
  }
}

async function transcribe(req: Extract<AsrRequest, { type: 'transcribe' }>): Promise<AsrChunk[]> {
  const isCancelled = () => cancelled.has(req.id);
  const progress = (phase: AsrPhase, ratio: number) => post({ type: 'progress', id: req.id, phase, ratio });
  if (req.mock) {
    for (let i = 1; i <= 4; i++) {
      await new Promise((r) => setTimeout(r, 60));
      if (isCancelled()) throw new Cancelled();
      progress('transcribe', i / 4);
    }
    return MOCK_CHUNKS.map((c) => ({ text: c.text, timestamp: [c.timestamp[0], c.timestamp[1]] }));
  }
  const model = findModel(req.modelId);
  const run = await loadModel(model, progress);
  if (isCancelled()) throw new Cancelled();
  progress('decode', 0);
  const audio = await decode16k(req.file, (r) => progress('decode', r), isCancelled);
  const segment = SEGMENT_SECONDS * ASR_SAMPLE_RATE;
  const chunks: AsrChunk[] = [];
  progress('transcribe', 0);
  for (let at = 0; at < audio.length; at += segment) {
    if (isCancelled()) throw new Cancelled();
    const piece = audio.subarray(at, Math.min(audio.length, at + segment));
    if (piece.length < ASR_SAMPLE_RATE * 0.1) break;
    const offset = at / ASR_SAMPLE_RATE;
    const out = await run(piece, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      task: 'transcribe',
      ...(req.language ? { language: req.language } : {}),
    });
    const got: AsrChunk[] = out.chunks ?? [{ text: out.text, timestamp: [0, piece.length / ASR_SAMPLE_RATE] }];
    for (const c of got) {
      const [s, e] = c.timestamp;
      chunks.push({ text: c.text, timestamp: [s + offset, e === null ? null : e + offset] });
    }
    progress('transcribe', Math.min(1, (at + piece.length) / audio.length));
  }
  return chunks;
}

scope.addEventListener('message', async (e) => {
  const msg = e.data;
  if (msg.type === 'cancel') {
    cancelled.add(msg.id);
    return;
  }
  if (msg.type === 'transcribe') {
    try {
      post({ type: 'result', id: msg.id, chunks: await transcribe(msg) });
    } catch (err) {
      post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
    } finally {
      cancelled.delete(msg.id);
    }
  }
});
