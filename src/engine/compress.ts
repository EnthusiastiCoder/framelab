// PURE compress bitrate math: target size -> video bitrate, and quality presets per resolution.

/** Share of the target size reserved for container overhead (moov/cues, headers). */
export const CONTAINER_MARGIN = 0.03;

export interface TargetInput {
  targetMB: number;
  durationSec: number;
  /** Audio bits per second (0 when the output has no audio). */
  audioBitrate: number;
}

/** Video bits per second that make the whole file land on `targetMB` (1 MB = 1e6 bytes). Throws when impossible. */
export function videoBitrateForTarget({ targetMB, durationSec, audioBitrate }: TargetInput): number {
  if (!(durationSec > 0)) throw new RangeError('The video duration is unknown, so a target size cannot be planned.');
  if (!(targetMB > 0)) throw new RangeError('The target size must be above 0 MB.');
  const raw = (targetMB * 1e6 * 8 - audioBitrate * durationSec) / durationSec;
  const video = raw * (1 - CONTAINER_MARGIN);
  if (video <= 0) {
    const audioMB = (audioBitrate * durationSec) / 8 / 1e6;
    throw new RangeError(`The target is smaller than the audio alone (about ${audioMB.toFixed(2)} MB). Pick a larger size.`);
  }
  return Math.round(video);
}

export type Preset = 'small' | 'balanced' | 'high';

/** Bits per pixel per frame at 30 fps for each preset (H.264-class codecs). */
const BPP: Record<Preset, number> = { small: 0.04, balanced: 0.08, high: 0.14 };

/** Video bits per second for a preset at a given output height (16:9 width assumed), clamped to a sane range. */
export function presetBitrate(preset: Preset, height: number, fps = 30): number {
  const h = Math.max(144, height);
  const w = Math.round((h * 16) / 9);
  const bps = w * h * Math.min(60, Math.max(1, fps)) * BPP[preset];
  return Math.round(Math.min(12_000_000, Math.max(200_000, bps)));
}

/** Audio bits per second per preset. */
export const PRESET_AUDIO: Record<Preset, number> = { small: 96_000, balanced: 128_000, high: 192_000 };
