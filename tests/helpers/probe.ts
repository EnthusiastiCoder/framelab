// Reads an output file with mediabunny in Node (metadata only; no decoding, so no WebCodecs needed).
import { readFileSync } from 'node:fs';
import { ALL_FORMATS, BufferSource, Input } from 'mediabunny';

export interface ProbeResult {
  duration: number;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  videoTracks: number;
  audioTracks: number;
  trackCount: number;
  frameRate: number | null;
  videoDuration: number | null;
  audioDuration: number | null;
  mimeType: string;
}

export async function probe(path: string): Promise<ProbeResult> {
  const bytes = readFileSync(path);
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  try {
    const [video, audio, tracks] = await Promise.all([input.getVideoTracks(), input.getAudioTracks(), input.getTracks()]);
    const v = video[0] ?? null;
    const a = audio[0] ?? null;
    const stats = v ? await v.computePacketStats(120) : null;
    return {
      duration: await input.computeDuration(),
      width: v ? v.displayWidth : null,
      height: v ? v.displayHeight : null,
      videoCodec: v ? v.codec : null,
      audioCodec: a ? a.codec : null,
      videoTracks: video.length,
      audioTracks: audio.length,
      trackCount: tracks.length,
      frameRate: stats ? stats.averagePacketRate : null,
      videoDuration: v ? await v.computeDuration() : null,
      audioDuration: a ? await a.computeDuration() : null,
      mimeType: await input.getMimeType(),
    };
  } finally {
    input.dispose();
  }
}

/** Minimal GIF reader: magic, logical screen size and the number of image frames. */
export function probeGif(path: string): { magic: string; width: number; height: number; frames: number } {
  const b = readFileSync(path);
  const magic = b.subarray(0, 6).toString('ascii');
  const width = b.readUInt16LE(6);
  const height = b.readUInt16LE(8);
  let p = 13;
  const flags = b[10];
  if (flags & 0x80) p += 3 * (1 << ((flags & 0x07) + 1));
  let frames = 0;
  const skipSubBlocks = () => {
    while (p < b.length && b[p] !== 0) p += b[p] + 1;
    p += 1;
  };
  while (p < b.length) {
    const block = b[p++];
    if (block === 0x3b) break; // trailer
    if (block === 0x21) {
      p += 1; // label
      skipSubBlocks();
    } else if (block === 0x2c) {
      frames++;
      const lflags = b[p + 8];
      p += 9;
      if (lflags & 0x80) p += 3 * (1 << ((lflags & 0x07) + 1));
      p += 1; // LZW min code size
      skipSubBlocks();
    } else {
      throw new Error(`unexpected GIF block 0x${block.toString(16)} at ${p - 1}`);
    }
  }
  return { magic, width, height, frames };
}
