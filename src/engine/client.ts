// Main-thread client for the engine worker. Creates the worker lazily and recreates it after a crash,
// an out-of-memory error or an internal error. Every rejection is an EngineError.

import { EngineError, type InputInfo, type Job, type Progress, type Result } from './types';
import type { WorkerRequest, WorkerResponse } from './worker';

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: EngineError) => void;
  onProgress?: (p: Progress) => void;
}

export interface ClientRunOptions {
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
  /** Test hook (?slow=1): an abortable wait before the job starts. */
  slowMs?: number;
}

export class EngineClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'framelab-engine' });
    w.addEventListener('message', (e: MessageEvent<WorkerResponse>) => this.onMessage(e.data));
    w.addEventListener('error', (e) => {
      e.preventDefault?.();
      this.crash(new EngineError('INTERNAL', 'The media engine stopped unexpectedly.'));
    });
    this.worker = w;
    return w;
  }

  private crash(err: EngineError) {
    this.worker?.terminate();
    this.worker = null;
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  private onMessage(msg: WorkerResponse) {
    const p = this.pending.get(msg.id);
    if (!p) return;
    if (msg.type === 'progress') {
      p.onProgress?.(msg.progress);
      return;
    }
    this.pending.delete(msg.id);
    if (msg.type === 'error') {
      p.reject(new EngineError(msg.code, msg.message));
      if (msg.code === 'OUT_OF_MEMORY' || msg.code === 'INTERNAL') {
        this.worker?.terminate();
        this.worker = null;
        for (const other of this.pending.values()) other.reject(new EngineError(msg.code, msg.message));
        this.pending.clear();
      }
    } else if (msg.type === 'probe-result') {
      p.resolve(msg.info);
    } else if (msg.type === 'result') {
      p.resolve(msg.result);
    }
  }

  private send<T>(req: WorkerRequest, onProgress?: (p: Progress) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.set(req.id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
      try {
        this.ensure().postMessage(req);
      } catch (err) {
        this.pending.delete(req.id);
        reject(new EngineError('INTERNAL', (err as Error)?.message ?? 'Could not start the media engine.'));
      }
    });
  }

  probe(file: File): Promise<InputInfo> {
    return this.send<InputInfo>({ type: 'probe', id: this.nextId++, file });
  }

  run(job: Job, file: File, opts: ClientRunOptions = {}): Promise<Result> {
    const id = this.nextId++;
    if (opts.signal?.aborted) return Promise.reject(new EngineError('CANCELLED', 'The job was cancelled.'));
    const onAbort = () => this.worker?.postMessage({ type: 'cancel', id } satisfies WorkerRequest);
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    return this.send<Result>({ type: 'run', id, job, file, options: { slowMs: opts.slowMs } }, opts.onProgress).finally(() =>
      opts.signal?.removeEventListener('abort', onAbort),
    );
  }

  dispose() {
    this.crash(new EngineError('CANCELLED', 'The engine was closed.'));
  }
}
