// Output naming and sinks. The suggested filename is "<name>-framelab.<ext>".
// Sinks: BufferTarget (memory) everywhere; a StreamTarget onto a File System Access handle (disk) when available.

import { BufferTarget, StreamTarget, type StreamTargetChunk } from 'mediabunny';

export function outputFilename(inputName: string, ext: string): string {
  const base = inputName.replace(/[\\/]/g, '_');
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `${stem || 'video'}-framelab.${ext.replace(/^\./, '')}`;
}

export const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  gif: 'image/gif',
  flac: 'audio/flac',
};

export function memorySink(): BufferTarget {
  return new BufferTarget();
}

/** Wraps a FileSystemWritableFileStream (from showSaveFilePicker) as a mediabunny StreamTarget. */
export function diskSink(writable: WritableStream<StreamTargetChunk>): StreamTarget {
  return new StreamTarget(writable, { chunked: true });
}
