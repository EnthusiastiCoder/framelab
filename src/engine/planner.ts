// PURE engine planner: (job, caps, inputInfo) -> which path runs the job, and why.
// v1 is WebCodecs-only (no ffmpeg). When the requested output can't be encoded, the planner falls back to
// another container/codec the browser can encode (WebM: VP9/AV1 + Opus) and says so; when nothing works it
// returns 'unsupported' with a reason the UI shows on the unsupported-browser notice.
// Audio codecs WebCodecs lacks (MP3, FLAC) run on the "wasm" path when caps.wasmEncoders says a bundled encoder exists.

import type { EnginePath, OutputSpec } from './types';

export interface PlannerCaps {
  webCodecs: boolean;
  canEncode: Record<string, boolean>;
  canDecode: Record<string, boolean>;
  /** Codecs a bundled WebAssembly encoder can produce when WebCodecs cannot (the app passes mp3 and flac). */
  wasmEncoders?: Record<string, boolean>;
}

export interface PlannerInput {
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
}

export interface PlannerJob {
  op: string;
  output?: OutputSpec;
  /** True when the job changes the pictures or sound (resize, crop, bitrate, trim-exact...): no stream copy. */
  transcode?: boolean;
}

export interface Plan {
  path: EnginePath;
  reason: string;
  /** The output that will actually be written (differs from job.output after a fallback). */
  output?: OutputSpec;
  /** True when the output differs from what was asked for; the UI shows `reason` as a notice. */
  fallback?: boolean;
}

/** Codecs WebCodecs never encodes; only a bundled WebAssembly encoder (caps.wasmEncoders) can produce them. */
const NEVER_ENCODED = new Set(['flac']);

/** PCM is written in plain JS by mediabunny, so it never needs an encoder. */
const isPcm = (c: string) => c.startsWith('pcm-');

const LABEL: Record<string, string> = {
  'pcm-s16': 'WAV', avc: 'H.264', hevc: 'H.265', vp8: 'VP8', vp9: 'VP9', av1: 'AV1', aac: 'AAC', opus: 'Opus', mp3: 'MP3', flac: 'FLAC',
};
const label = (c: string) => LABEL[c] ?? c.toUpperCase();

function streamCopies(job: PlannerJob, input: PlannerInput, kind: 'video' | 'audio', codec: string): boolean {
  if (job.transcode) return false;
  const inCodec = kind === 'video' ? input.videoCodec : input.audioCodec;
  return !!inCodec && inCodec === codec;
}

/** Codecs that must be encoded (and decoded from the input) for this output. */
function needs(job: PlannerJob, input: PlannerInput, out: OutputSpec) {
  const encode: string[] = [];
  const decode: string[] = [];
  const keepAudio = job.op !== 'mute';
  const pairs: Array<['video' | 'audio', string | undefined]> = [
    ['video', out.videoCodec],
    ['audio', keepAudio ? out.audioCodec : undefined],
  ];
  for (const [kind, codec] of pairs) {
    if (!codec) continue;
    if (streamCopies(job, input, kind, codec)) continue;
    encode.push(codec);
    const inCodec = kind === 'video' ? input.videoCodec : input.audioCodec;
    if (inCodec) decode.push(inCodec);
  }
  return { encode, decode };
}

function missing(caps: PlannerCaps, job: PlannerJob, input: PlannerInput, out: OutputSpec) {
  const { encode, decode } = needs(job, input, out);
  return {
    encode: encode.filter((c) => !isPcm(c) && (NEVER_ENCODED.has(c) || !caps.canEncode[c])),
    decode: decode.filter((c) => !caps.canDecode[c]),
  };
}

/** A WebM fallback the browser can encode, or null. */
function webmFallback(caps: PlannerCaps, job: PlannerJob, input: PlannerInput, out: OutputSpec): OutputSpec | null {
  const wantsVideo = !!out.videoCodec;
  const wantsAudio = !!out.audioCodec && job.op !== 'mute';
  const video = wantsVideo ? (['vp9', 'av1', 'vp8'].find((c) => caps.canEncode[c]) ?? null) : undefined;
  const audio = wantsAudio ? (caps.canEncode.opus ? 'opus' : null) : undefined;
  if (video === null || audio === null) return null;
  const candidate: OutputSpec = { container: 'webm', ...(video ? { videoCodec: video } : {}), ...(audio ? { audioCodec: audio } : {}) };
  const m = missing(caps, { ...job, transcode: true }, input, candidate);
  return m.encode.length === 0 && m.decode.length === 0 ? candidate : null;
}

export function planPath(job: PlannerJob, caps: PlannerCaps, inputInfo: PlannerInput, _opts: object = {}): Plan {
  if (!caps.webCodecs) {
    return {
      path: 'unsupported',
      reason: 'This browser does not support WebCodecs video encoding, which Framelab needs to process video on your device.',
    };
  }
  const out: OutputSpec = job.output ?? {
    container: inputInfo.container ?? 'mp4',
    videoCodec: inputInfo.videoCodec,
    audioCodec: job.op === 'mute' ? undefined : inputInfo.audioCodec,
  };
  const m = missing(caps, job, inputInfo, out);

  if (m.decode.length > 0) {
    return {
      path: 'unsupported',
      reason: `This browser cannot decode ${m.decode.map(label).join(' and ')} from this file.`,
    };
  }
  if (m.encode.length === 0) {
    const copy = needs(job, inputInfo, out).encode.length === 0;
    return {
      path: 'webcodecs',
      reason: copy ? 'Streams are copied without re-encoding.' : 'Every codec this job needs is supported by WebCodecs.',
      output: out,
    };
  }

  const what = m.encode.map(label).join(' and ');
  if (m.encode.every((c) => caps.wasmEncoders?.[c])) {
    return {
      path: 'wasm',
      reason: `WebCodecs has no ${what} encoder, so a bundled WebAssembly encoder is used.`,
      output: out,
    };
  }
  if (m.encode.some((c) => NEVER_ENCODED.has(c))) {
    return { path: 'unsupported', reason: `${what} output is not available in this version of Framelab; pick another format.` };
  }
  if (!out.videoCodec && out.audioCodec !== 'opus' && caps.canEncode.opus) {
    return {
      path: 'webcodecs',
      reason: `Your browser can't encode ${what} locally, so ${out.container.toUpperCase()} isn't possible here; saving as OGG (Opus) instead.`,
      output: { container: 'ogg', audioCodec: 'opus' },
      fallback: true,
    };
  }
  const fb = out.container === 'webm' || !out.videoCodec ? null : webmFallback(caps, job, inputInfo, out);
  if (fb) {
    const container = out.container.toUpperCase();
    return {
      path: 'webcodecs',
      reason: `Your browser can't encode ${what} locally, so ${container} isn't possible here; saving as WebM (${[fb.videoCodec, fb.audioCodec].filter(Boolean).map((c) => label(c!)).join(' + ')}) instead.`,
      output: fb,
      fallback: true,
    };
  }
  return { path: 'unsupported', reason: `This browser cannot encode ${what}, and no other format it can encode fits this job.` };
}
