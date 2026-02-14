// Engine worker (module worker). All media work runs here, off the main thread.
// Protocol (main -> worker): probe | run | cancel. (worker -> main): probe-result | progress | result | error.

import { EngineError, toErrorCode, type Job, type Progress, type Result } from './types';
import { probeFile } from './mediabunny/probe';
import { mute, transcode, type RunOptions } from './mediabunny/convert';
import { cut } from './mediabunny/ranges';
import { toGif } from './mediabunny/gif';
import { audioPeaks } from './mediabunny/audio';
import { burnSubtitles } from '../subtitles/burn';

export type WorkerRequest =
  | { type: 'probe'; id: number; file: File }
  | { type: 'run'; id: number; job: Job; file: File; options?: { slowMs?: number } }
  | { type: 'cancel'; id: number };

export type WorkerResponse =
  | { type: 'probe-result'; id: number; info: import('./types').InputInfo }
  | { type: 'progress'; id: number; progress: Progress }
  | { type: 'result'; id: number; result: import('./types').Result }
  | { type: 'error'; id: number; code: import('./types').EngineErrorCode; message: string };

const scope = self as unknown as {
  postMessage(msg: WorkerResponse): void;
  addEventListener(type: 'message', fn: (e: MessageEvent<WorkerRequest>) => void): void;
};

const running = new Map<number, AbortController>();

function fail(id: number, err: unknown) {
  const code = toErrorCode(err);
  const message = err instanceof Error ? err.message : String(err);
  scope.postMessage({ type: 'error', id, code, message });
}

async function dispatch(job: Job, file: File, opts: RunOptions): Promise<Result> {
  switch (job.op) {
    case 'mute':
      return mute(file, opts);
    case 'cut':
      return cut(file, job, opts);
    case 'gif':
      return toGif(file, job, opts);
    case 'burn':
      return burnSubtitles(file, job, opts);
    case 'peaks': {
      const peaks = await audioPeaks(file, job.count, opts.signal);
      return { peaks, blob: new Blob([]), filename: '', mimeType: '', size: 0 };
    }
    case 'compress':
    case 'convert':
    case 'trim':
    case 'resize':
    case 'extract-audio':
    case 'audio-cut':
    case 'audio-convert':
      return transcode(file, job, opts);
    default:
      throw new EngineError('UNSUPPORTED_OUTPUT', `The "${(job as { op: string }).op}" tool is not available.`);
  }
}

scope.addEventListener('message', async (e) => {
  const msg = e.data;
  if (msg.type === 'cancel') {
    running.get(msg.id)?.abort();
    return;
  }
  if (msg.type === 'probe') {
    try {
      scope.postMessage({ type: 'probe-result', id: msg.id, info: await probeFile(msg.file) });
    } catch (err) {
      fail(msg.id, err);
    }
    return;
  }
  if (msg.type === 'run') {
    const controller = new AbortController();
    running.set(msg.id, controller);
    try {
      const result = await dispatch(msg.job, msg.file, {
        signal: controller.signal,
        slowMs: msg.options?.slowMs,
        onProgress: (progress) => scope.postMessage({ type: 'progress', id: msg.id, progress }),
      });
      scope.postMessage({ type: 'result', id: msg.id, result });
    } catch (err) {
      fail(msg.id, err);
    } finally {
      running.delete(msg.id);
    }
  }
});
