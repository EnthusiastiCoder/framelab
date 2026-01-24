// Engine worker (module worker). All media work runs here, off the main thread.
// Protocol (main -> worker): probe | run | cancel. (worker -> main): probe-result | progress | result | error.

import { EngineError, toErrorCode, type Job, type Progress } from './types';
import { probeFile } from './mediabunny/probe';
import { mute } from './mediabunny/convert';

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
      if (msg.job.op !== 'mute') throw new EngineError('UNSUPPORTED_OUTPUT', `The "${msg.job.op}" tool is not available yet.`);
      const result = await mute(msg.file, {
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
