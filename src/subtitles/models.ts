// The Whisper models Framelab offers. Decision 3 (WS0): every file is self-hosted on our own origin under
// /models/<id>/<revision>/, and any file over 24 MiB ships as .partN chunks (Cloudflare Pages caps a file at
// 25 MiB). The revision pins the upstream snapshot that was vendored; nothing is fetched from a third party.
// scripts/fetch-models.mjs mirrors exactly these files (and parts) at deploy time.

export interface ModelFile {
  /** Path inside the model repository, e.g. "onnx/encoder_model_quantized.onnx". */
  path: string;
  bytes: number;
  /** SHA-256 of the whole file (known for the large ONNX files; checked after reassembly). */
  sha256?: string;
}

export interface WhisperModel {
  id: string;
  /** Short name for the picker. */
  name: string;
  revision: string;
  /** Total bytes of every file the runtime fetches. */
  bytes: number;
  /** Picker label with the download size, e.g. "Base (balanced), 80 MB". */
  label: string;
  files: ModelFile[];
}

/** Same-origin URL prefix of the self-hosted models. */
export const MODEL_BASE = '/models/';
/** Largest single file served; bigger files are split into parts (matches scripts/vendor-assets.mjs). */
export const MAX_PART = 24 * 1024 * 1024;

const json = (generation: number, tokenizerConfig: number, config: number): ModelFile[] => [
  { path: 'config.json', bytes: config },
  { path: 'generation_config.json', bytes: generation },
  { path: 'preprocessor_config.json', bytes: 339 },
  { path: 'tokenizer.json', bytes: 2480466 },
  { path: 'tokenizer_config.json', bytes: tokenizerConfig },
];

function model(id: string, name: string, revision: string, files: ModelFile[]): WhisperModel {
  const bytes = files.reduce((n, f) => n + f.bytes, 0);
  return { id, name, revision, bytes, label: `${name}, ${Math.round(bytes / 1e6)} MB`, files };
}

export const MODELS: WhisperModel[] = [
  model('onnx-community/whisper-tiny', 'Tiny (fastest)', 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7', [
    ...json(3772, 282683, 2243),
    { path: 'onnx/encoder_model_quantized.onnx', bytes: 10124990, sha256: '2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19' },
    { path: 'onnx/decoder_model_merged_quantized.onnx', bytes: 30719241, sha256: '25e807a962b6349356d0ea5d0dfe530b7e5bf0e2a484aeca0359d03143faddd3' },
  ]),
  model('onnx-community/whisper-base', 'Base (balanced)', '27a07b4b52b3a4c5886134bb4320e93e1a4bbc7c', [
    ...json(3832, 282682, 2243),
    { path: 'onnx/encoder_model_quantized.onnx', bytes: 23201314, sha256: '5862993336bf33acd23736071aae2b32261d3b1b2f37780194460d4ef974dd46' },
    { path: 'onnx/decoder_model_merged_quantized.onnx', bytes: 53693315, sha256: 'fa3ef9902734ce5ae6f9ef2bdb2ba9a6c4b5785b09f4f420ce036573dc9d090b' },
  ]),
  model('onnx-community/whisper-small', 'Small (most accurate)', '36050c46d777d46dc4b5f43f6d90574fc38f8732', [
    ...json(3893, 282683, 2227),
    { path: 'onnx/encoder_model_quantized.onnx', bytes: 92326160, sha256: 'a43a83f3c5361cd591cfa7c36f14b43cf7cb22f47a415cc14a8d557be800fa92' },
    { path: 'onnx/decoder_model_merged_quantized.onnx', bytes: 156750845, sha256: 'ec07c3cbb64172c39791e26ee870a65ac22b458c36722bfe2776b3dbf741e0c9' },
  ]),
];

export const DEFAULT_MODEL_ID = 'onnx-community/whisper-base';

export function findModel(id: string): WhisperModel {
  return MODELS.find((m) => m.id === id) ?? MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!;
}

/** Number of parts a file of `bytes` is served in. */
export function partCount(bytes: number): number {
  return Math.max(1, Math.ceil(bytes / MAX_PART));
}

/** Byte ranges of each part (the same plan as scripts/vendor-assets.mjs planChunks). */
export function partPlan(bytes: number): Array<{ offset: number; length: number }> {
  const count = partCount(bytes);
  if (count === 1) return [{ offset: 0, length: bytes }];
  const base = Math.ceil(bytes / count);
  const plan: Array<{ offset: number; length: number }> = [];
  for (let offset = 0; offset < bytes; offset += base) plan.push({ offset, length: Math.min(base, bytes - offset) });
  return plan;
}

/** Same-origin URL of a whole model file (the runtime's cache key; may be served in parts). */
export function modelFileUrl(m: Pick<WhisperModel, 'id' | 'revision'>, path: string): string {
  return `${MODEL_BASE}${m.id}/${m.revision}/${path}`;
}

/** The URLs of the parts that make up one file (the file itself when it fits in one part). */
export function partUrls(m: Pick<WhisperModel, 'id' | 'revision'>, file: ModelFile): string[] {
  const url = modelFileUrl(m, file.path);
  const n = partCount(file.bytes);
  return n === 1 ? [url] : Array.from({ length: n }, (_, i) => `${url}.part${i}`);
}

/** Every URL the runtime fetches for a model, parts included. */
export function modelFileUrls(m: WhisperModel): string[] {
  return m.files.flatMap((f) => partUrls(m, f));
}
