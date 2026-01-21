// Capability detection. Takes the global scope as a parameter so tests can pass mocked globals.
// Never throws: every probe is guarded and missing features are reported as false (or null).

export interface Capabilities {
  webCodecs: boolean;
  videoEncoder: boolean;
  videoDecoder: boolean;
  audioEncoder: boolean;
  audioDecoder: boolean;
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
  fileSystemAccess: boolean;
  deviceMemory: number | null;
  webGPU: boolean;
  offscreenCanvas: boolean;
  /** Keyed by mediabunny codec names (avc, vp9, av1, aac, opus, mp3, flac). */
  canEncode: Record<string, boolean>;
  canDecode: Record<string, boolean>;
}

export const VIDEO_CODECS: Record<string, string> = {
  avc: 'avc1.42001f',
  vp9: 'vp09.00.31.08',
  av1: 'av01.0.05M.08',
};

export const AUDIO_CODECS: Record<string, string> = {
  aac: 'mp4a.40.2',
  opus: 'opus',
  mp3: 'mp3',
  flac: 'flac',
};

type AnyGlobal = Record<string, any>;

const isFn = (v: unknown): boolean => typeof v === 'function';

async function supported(ctor: any, config: object): Promise<boolean> {
  if (!isFn(ctor) || !isFn(ctor.isConfigSupported)) return false;
  try {
    const timeout = new Promise<{ supported: boolean }>((resolve) => setTimeout(() => resolve({ supported: false }), 3000));
    const r = await Promise.race([ctor.isConfigSupported(config), timeout]);
    return !!r?.supported;
  } catch {
    return false;
  }
}

function get(g: AnyGlobal, key: string): any {
  try {
    return g?.[key];
  } catch {
    return undefined;
  }
}

export async function detectCapabilities(g: object = globalThis): Promise<Capabilities> {
  const G = g as AnyGlobal;
  const nav = get(G, 'navigator') ?? {};
  const VE = get(G, 'VideoEncoder');
  const VD = get(G, 'VideoDecoder');
  const AE = get(G, 'AudioEncoder');
  const AD = get(G, 'AudioDecoder');

  const canEncode: Record<string, boolean> = {};
  const canDecode: Record<string, boolean> = {};
  const video = { width: 1280, height: 720, bitrate: 2_000_000, framerate: 30 };
  const audio = { sampleRate: 48000, numberOfChannels: 2, bitrate: 128_000 };

  await Promise.all([
    ...Object.entries(VIDEO_CODECS).map(async ([name, codec]) => {
      canEncode[name] = await supported(VE, { codec, ...video });
      canDecode[name] = await supported(VD, { codec, codedWidth: video.width, codedHeight: video.height });
    }),
    ...Object.entries(AUDIO_CODECS).map(async ([name, codec]) => {
      canEncode[name] = await supported(AE, { codec, ...audio });
      canDecode[name] = await supported(AD, { codec, sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels });
    }),
  ]);

  let deviceMemory: number | null = null;
  try {
    const dm = nav.deviceMemory;
    deviceMemory = typeof dm === 'number' && Number.isFinite(dm) ? dm : null;
  } catch {
    deviceMemory = null;
  }

  let webGPU = false;
  try {
    webGPU = !!nav.gpu;
  } catch {
    webGPU = false;
  }

  return {
    webCodecs: isFn(VE) && isFn(VD),
    videoEncoder: isFn(VE),
    videoDecoder: isFn(VD),
    audioEncoder: isFn(AE),
    audioDecoder: isFn(AD),
    crossOriginIsolated: get(G, 'crossOriginIsolated') === true,
    sharedArrayBuffer: isFn(get(G, 'SharedArrayBuffer')),
    fileSystemAccess: isFn(get(G, 'showSaveFilePicker')),
    deviceMemory,
    webGPU,
    offscreenCanvas: isFn(get(G, 'OffscreenCanvas')),
    canEncode,
    canDecode,
  };
}

/** Plain-words list of missing features, for the CapabilityBanner. Empty when nothing important is missing. */
export function missingFeatures(caps: Capabilities): string[] {
  const out: string[] = [];
  if (!caps.videoEncoder) out.push('video encoding (WebCodecs VideoEncoder)');
  if (!caps.videoDecoder) out.push('video decoding (WebCodecs VideoDecoder)');
  if (caps.videoEncoder && !caps.audioEncoder) out.push('audio encoding (WebCodecs AudioEncoder)');
  if (!caps.crossOriginIsolated) out.push('cross-origin isolation');
  return out;
}
