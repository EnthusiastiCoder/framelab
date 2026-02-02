// PURE helpers the tool islands share: output specs per format, time parsing and size estimates.

import type { InputInfo, OutputSpec } from '../engine/types';
import { parse } from '../engine/timecode';

/** The output for a video tool that keeps the input's family: WebM/MKV stay WebM (VP9/Opus), the rest MP4. */
export function sameFamilyVideo(info: InputInfo): OutputSpec {
  const webm = info.container === 'webm' || info.container === 'mkv';
  return {
    container: webm ? 'webm' : 'mp4',
    videoCodec: webm ? 'vp9' : 'avc',
    ...(info.audioTracks > 0 ? { audioCodec: webm ? 'opus' : 'aac' } : {}),
  };
}

export type VideoFormat = 'mp4' | 'webm';

export function videoFormatOutput(format: VideoFormat, info: InputInfo): OutputSpec {
  const audio = info.audioTracks > 0;
  return format === 'webm'
    ? { container: 'webm', videoCodec: 'vp9', ...(audio ? { audioCodec: 'opus' } : {}) }
    : { container: 'mp4', videoCodec: 'avc', ...(audio ? { audioCodec: 'aac' } : {}) };
}

export type AudioFormat = 'mp3' | 'm4a' | 'wav' | 'ogg' | 'flac';

export const AUDIO_FORMATS: Array<{ value: AudioFormat; label: string }> = [
  { value: 'mp3', label: 'MP3' },
  { value: 'm4a', label: 'M4A' },
  { value: 'wav', label: 'WAV' },
  { value: 'ogg', label: 'Opus' },
  { value: 'flac', label: 'FLAC' },
];

const AUDIO_CODEC: Record<AudioFormat, string> = { mp3: 'mp3', m4a: 'aac', wav: 'pcm-s16', ogg: 'opus', flac: 'flac' };

export function audioFormatOutput(format: AudioFormat): OutputSpec {
  return { container: format, audioCodec: AUDIO_CODEC[format] };
}

/** The audio format of an input file, when Framelab can write it back. */
export function audioFormatOf(info: InputInfo): AudioFormat | null {
  switch (info.container) {
    case 'mp3':
      return 'mp3';
    case 'wav':
      return 'wav';
    case 'ogg':
      return info.audioCodec === 'opus' ? 'ogg' : null;
    case 'flac':
      return 'flac';
    case 'mp4':
    case 'mov':
      return info.videoTracks === 0 ? 'm4a' : null;
    default:
      return null;
  }
}

/** Seconds from "mm:ss.mmm", "h:mm:ss" or plain seconds; null when empty or invalid. */
export function parseTime(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  try {
    const t = parse(String(text));
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

/** Typical bits per second of an audio output, for size estimates. */
export function audioBitrateFor(format: AudioFormat, kbps: number, info: { sampleRate?: number } = {}): number {
  if (format === 'wav') return (info.sampleRate ?? 48_000) * 2 * 16;
  if (format === 'flac') return (info.sampleRate ?? 48_000) * 2 * 16 * 0.6;
  return kbps * 1000;
}

/** Whole-file bits per second of the input. */
export function inputBitrate(size: number, duration: number): number {
  return duration > 0 ? (size * 8) / duration : 0;
}
