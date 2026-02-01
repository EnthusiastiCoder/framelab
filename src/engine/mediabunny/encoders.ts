// Bundled WebAssembly audio encoders for the codecs WebCodecs lacks (MP3, FLAC). Each one is imported lazily, only
// when a job needs it, so its chunk never loads for other jobs. Runs in the worker.

import { canEncodeAudio } from 'mediabunny';

const registered = new Set<string>();

/** Makes sure `codec` can be encoded, registering the bundled encoder when the browser has none. */
export async function ensureEncoder(codec: string | undefined): Promise<void> {
  if (!codec || registered.has(codec)) return;
  if (codec === 'mp3') {
    if (!(await canEncodeAudio('mp3'))) (await import('@mediabunny/mp3-encoder')).registerMp3Encoder();
    registered.add(codec);
  } else if (codec === 'flac') {
    if (!(await canEncodeAudio('flac'))) (await import('@mediabunny/flac-encoder')).registerFlacEncoder();
    registered.add(codec);
  }
}
