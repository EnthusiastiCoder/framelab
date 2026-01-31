// Shared engine types: jobs, progress, results and error codes. Pure types, no runtime dependencies.

/**
 * The engine path a job runs on. 'webcodecs' uses the browser's encoders; 'wasm' adds a bundled WebAssembly audio
 * encoder (MP3, FLAC) where WebCodecs has none; 'unsupported' means the browser lacks what the job needs.
 */
export type EnginePath = 'webcodecs' | 'wasm' | 'unsupported';

export interface OutputSpec {
  container: string;
  videoCodec?: string;
  audioCodec?: string;
}

export interface MuteJob {
  op: 'mute';
  output?: OutputSpec;
}

/** Generic convert-style job shape (WS2 widens the union with compress, convert, trim, ...). */
export interface ConvertJob {
  op: string;
  output: OutputSpec;
  [option: string]: unknown;
}

export type Job = MuteJob | ConvertJob;

export interface Progress {
  phase: 'reading' | 'processing' | 'writing' | 'done';
  /** 0..1 */
  ratio: number;
  etaSeconds?: number;
}

export interface Result {
  blob: Blob;
  filename: string;
  mimeType: string;
  size: number;
}

export interface InputInfo {
  container: string;
  mimeType?: string;
  duration: number;
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  videoTracks: number;
  audioTracks: number;
}

export type EngineErrorCode =
  | 'UNSUPPORTED_INPUT'
  | 'UNSUPPORTED_OUTPUT'
  | 'UNSUPPORTED_BROWSER'
  | 'OUT_OF_MEMORY'
  | 'CORRUPT_INPUT'
  | 'CANCELLED'
  | 'INTERNAL';

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

/** A concrete next step for each error code, shown on the ErrorCard. */
export const NEXT_STEPS: Record<EngineErrorCode, string> = {
  UNSUPPORTED_INPUT: 'Try a different file: MP4, MOV, WebM and MKV videos work best.',
  UNSUPPORTED_OUTPUT: 'Pick another output format, or try Chrome or Edge, which can encode more formats.',
  UNSUPPORTED_BROWSER: 'Open Framelab in a recent Chrome, Edge, Safari or Firefox.',
  OUT_OF_MEMORY: 'Lower the resolution, or turn on save-to-disk in Chrome or Edge, then try again.',
  CORRUPT_INPUT: 'This file looks damaged or is not a video. Re-export or re-download it, then try again.',
  CANCELLED: 'Run the job again when you are ready.',
  INTERNAL: 'Reload the page and try again. If it keeps happening, try Chrome or Edge.',
};

/** Maps any thrown value to an engine error code. */
export function toErrorCode(err: unknown): EngineErrorCode {
  if (err instanceof EngineError) return err.code;
  const name = (err as { name?: string } | null)?.name ?? '';
  const msg = String((err as { message?: string } | null)?.message ?? err ?? '').toLowerCase();
  if (name === 'AbortError' || name === 'ConversionCanceledError' || /cancel/.test(msg)) return 'CANCELLED';
  if (name === 'RangeError' || /out of memory|memory access out of bounds|allocation failed|array buffer allocation/.test(msg)) {
    return 'OUT_OF_MEMORY';
  }
  if (/unsupported or unrecognizable format|unrecognized|no video track|no tracks|invalid|corrupt|malformed|unexpected end/.test(msg)) {
    return 'CORRUPT_INPUT';
  }
  if (/unsupported/.test(msg)) return 'UNSUPPORTED_INPUT';
  return 'INTERNAL';
}
