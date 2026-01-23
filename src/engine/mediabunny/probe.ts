// Media probe (runs in the worker): reads container, tracks, codecs, size and duration with mediabunny.
// Throws EngineError CORRUPT_INPUT for unreadable or track-less files.

import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { EngineError, type InputInfo } from '../types';

const CONTAINER_BY_NAME: Array<[RegExp, string]> = [
  [/quicktime|mov/i, 'mov'],
  [/mp4|isobmff/i, 'mp4'],
  [/webm/i, 'webm'],
  [/matroska|mkv/i, 'mkv'],
  [/mp3/i, 'mp3'],
  [/wave|wav/i, 'wav'],
  [/ogg/i, 'ogg'],
  [/adts|aac/i, 'aac'],
  [/flac/i, 'flac'],
];

export function containerFromFormatName(name: string): string {
  for (const [re, c] of CONTAINER_BY_NAME) if (re.test(name)) return c;
  return name.toLowerCase();
}

export function openInput(file: Blob): Input {
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

export async function probeFile(file: Blob): Promise<InputInfo> {
  const input = openInput(file);
  try {
    let formatName: string;
    let mimeType: string | undefined;
    try {
      const format = await input.getFormat();
      formatName = format.name;
      mimeType = await input.getMimeType().catch(() => undefined);
    } catch {
      throw new EngineError('CORRUPT_INPUT', 'This file is not a video or audio file Framelab can read.');
    }
    let videoTracks: Awaited<ReturnType<Input['getVideoTracks']>>;
    let audioTracks: Awaited<ReturnType<Input['getAudioTracks']>>;
    try {
      videoTracks = await input.getVideoTracks();
      audioTracks = await input.getAudioTracks();
    } catch {
      throw new EngineError('CORRUPT_INPUT', 'This file looks damaged: its track list could not be read.');
    }
    if (videoTracks.length + audioTracks.length === 0) {
      throw new EngineError('CORRUPT_INPUT', 'This file looks damaged or truncated: it has no readable video or audio.');
    }
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    let duration = 0;
    try {
      duration = await input.computeDuration();
    } catch {
      duration = 0;
    }
    let frameRate: number | undefined;
    if (video) {
      try {
        const stats = await video.computePacketStats(60);
        frameRate = stats.averagePacketRate || undefined;
      } catch {
        frameRate = undefined;
      }
    }
    return {
      container: containerFromFormatName(formatName),
      mimeType,
      duration,
      videoCodec: video?.codec ?? undefined,
      audioCodec: audio?.codec ?? undefined,
      width: video?.displayWidth,
      height: video?.displayHeight,
      frameRate,
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
    };
  } finally {
    input.dispose?.();
  }
}
