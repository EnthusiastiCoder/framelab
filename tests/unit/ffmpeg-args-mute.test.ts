// U5 output naming (mute): src/engine/output.ts
// API: outputFilename(inputName: string, ext: string): string   -> "<name>-framelab.<ext>"
// v1 is WebCodecs-only (CTO decision): the buildFfmpegArgs case was removed; the naming case stays.
import { describe, it, expect } from 'vitest';

const loadOutput = () => import('../../src/engine/output');

describe('U5 output naming (mute)', () => {
  it('suggests an output name ending in -framelab.mp4', async () => {
    const { outputFilename } = await loadOutput();
    expect(outputFilename('clip.mp4', 'mp4')).toBe('clip-framelab.mp4');
    expect(outputFilename('My Holiday.MOV', 'mp4')).toBe('My Holiday-framelab.mp4');
    expect(outputFilename('noext', 'mp4')).toBe('noext-framelab.mp4');
    expect(outputFilename('a.b.webm', 'mp4')).toMatch(/-framelab\.mp4$/);
  });
});
