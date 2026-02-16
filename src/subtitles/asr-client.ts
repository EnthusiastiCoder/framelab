// Main-thread client for the speech recognition worker (created lazily, one job at a time).

import type { AsrChunk } from './segment';
import type { AsrPhase, AsrRequest, AsrResponse } from './asr-protocol';

export interface TranscribeOptions {
  modelId: string;
  mock?: boolean;
  language?: string;
  signal?: AbortSignal;
  onProgress?: (phase: AsrPhase, ratio: number) => void;
}

export class AsrClient {
  private worker: Worker | null = null;
  private nextId = 1;

  private ensure(): Worker {
    this.worker ??= new Worker(new URL('./asr-worker.ts', import.meta.url), { type: 'module', name: 'framelab-asr' });
    return this.worker;
  }

  transcribe(file: File, opts: TranscribeOptions): Promise<AsrChunk[]> {
    const id = this.nextId++;
    const w = this.ensure();
    return new Promise<AsrChunk[]>((resolve, reject) => {
      const cleanup = () => {
        w.removeEventListener('message', onMessage);
        w.removeEventListener('error', onError);
        opts.signal?.removeEventListener('abort', onAbort);
      };
      const onMessage = (e: MessageEvent<AsrResponse>) => {
        const msg = e.data;
        if (msg.id !== id) return;
        if (msg.type === 'progress') {
          opts.onProgress?.(msg.phase, msg.ratio);
          return;
        }
        cleanup();
        if (msg.type === 'result') resolve(msg.chunks);
        else reject(new Error(msg.message));
      };
      const onError = (e: ErrorEvent) => {
        e.preventDefault?.();
        cleanup();
        this.dispose();
        reject(new Error('The speech recognition engine stopped unexpectedly.'));
      };
      const onAbort = () => {
        w.postMessage({ type: 'cancel', id } satisfies AsrRequest);
        cleanup();
        reject(new DOMException('Cancelled', 'AbortError'));
      };
      w.addEventListener('message', onMessage);
      w.addEventListener('error', onError);
      opts.signal?.addEventListener('abort', onAbort, { once: true });
      const req: AsrRequest = { type: 'transcribe', id, file, modelId: opts.modelId, mock: !!opts.mock, language: opts.language };
      w.postMessage(req);
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
}
