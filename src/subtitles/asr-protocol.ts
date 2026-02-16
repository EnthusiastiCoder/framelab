import type { AsrChunk } from './segment';

export type AsrRequest =
  | { type: 'transcribe'; id: number; file: File; modelId: string; mock: boolean; language?: string }
  | { type: 'cancel'; id: number };

export type AsrPhase = 'download' | 'decode' | 'transcribe';

export type AsrResponse =
  | { type: 'progress'; id: number; phase: AsrPhase; ratio: number }
  | { type: 'result'; id: number; chunks: AsrChunk[] }
  | { type: 'error'; id: number; message: string };
