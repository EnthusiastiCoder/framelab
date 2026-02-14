import type { AsrChunk } from './segment';

/** ?asr=mock: what the ASR worker returns without loading any model (tests and demos). */
export const MOCK_CHUNKS: AsrChunk[] = [
  { text: 'Hello and welcome to Framelab.', timestamp: [0.5, 1.8] },
  { text: 'Everything here runs in your browser.', timestamp: [2.0, 3.4] },
  { text: 'Your files never leave your device.', timestamp: [3.6, 4.9] },
];
