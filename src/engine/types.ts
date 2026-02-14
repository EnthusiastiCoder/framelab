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

/** Generic convert-style job shape. */
export interface ConvertJob {
  op: string;
  output: OutputSpec;
  [option: string]: unknown;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One job shape for every op that maps onto a single mediabunny Conversion: compress, convert, trim, resize,
 * extract-audio, audio-cut and audio-convert. `output` is the planned output (after any fallback).
 */
export interface TranscodeJob {
  op: 'compress' | 'convert' | 'trim' | 'resize' | 'extract-audio' | 'audio-cut' | 'audio-convert';
  output: OutputSpec;
  /** Seconds in the input. */
  trim?: { start: number; end: number };
  /** Fast trim: copy packets, snapping the start to the previous keyframe (no re-encode). */
  copyOnly?: boolean;
  /** Re-encode every stream even when the codec already matches. */
  forceTranscode?: boolean;
  videoBitrate?: number;
  audioBitrate?: number;
  /** Encode the video at a constant bitrate (target-size compress), so the file lands near the planned size. */
  constantBitrate?: boolean;
  /** Resize/crop: the region of the input that is used, the output size and where the region lands in it. */
  layout?: { output: { width: number; height: number }; source: CropRect; dest: CropRect };
  /** Fill the padding of a fit layout with a blurred, scaled copy of the frame. */
  blur?: boolean;
  /** Linear audio fades in seconds (audio cutter). */
  fade?: { fadeIn: number; fadeOut: number };
}

/** Cut: keeps the given ranges of the input and joins them. */
export interface CutJob {
  op: 'cut';
  output: OutputSpec;
  keep: Array<[number, number]>;
  videoBitrate?: number;
}

/** Video to GIF. */
export interface GifJob {
  op: 'gif';
  output?: OutputSpec;
  start: number;
  end: number;
  fps: number;
  width: number;
}

/** Waveform peaks of the first audio track (audio cutter display). */
export interface PeaksJob {
  op: 'peaks';
  output?: OutputSpec;
  count: number;
}

/** Burn subtitles into the video: re-encodes every frame with the active cue drawn on it. */
export interface BurnJob {
  op: 'burn';
  output: OutputSpec;
  cues: import('../subtitles/cue').Cue[];
  style: import('../subtitles/style').CaptionStyle;
  videoBitrate?: number;
}

export type Job = MuteJob | TranscodeJob | CutJob | GifJob | PeaksJob | BurnJob;

export interface Progress {
  phase: 'reading' | 'processing' | 'writing' | 'done';
  /** 0..1 */
  ratio: number;
  etaSeconds?: number;
}

export interface Result {
  /** Peaks jobs return their peaks here and an empty blob. */
  peaks?: Float32Array;
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
