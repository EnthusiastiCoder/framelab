// U5 ffmpeg args (mute): src/engine/ffmpeg/args.ts (PURE) + src/engine/output.ts
// API: buildFfmpegArgs(job, io: { input: string; output: string }): string[]
//      outputFilename(inputName: string, ext: string): string   -> "<name>-framelab.<ext>"
import { describe, it, expect } from 'vitest';

const loadArgs = () => import('../../src/engine/ffmpeg/args');
const loadOutput = () => import('../../src/engine/output');

describe('U5 ffmpeg args (mute)', () => {
  it('builds -i <in> -c:v copy -an <out>', async () => {
    const { buildFfmpegArgs } = await loadArgs();
    expect(buildFfmpegArgs({ op: 'mute' }, { input: '/in/clip.mp4', output: 'clip-framelab.mp4' })).toEqual([
      '-i',
      '/in/clip.mp4',
      '-c:v',
      'copy',
      '-an',
      'clip-framelab.mp4',
    ]);
  });

  it('suggests an output name ending in -framelab.mp4', async () => {
    const { outputFilename } = await loadOutput();
    expect(outputFilename('clip.mp4', 'mp4')).toBe('clip-framelab.mp4');
    expect(outputFilename('My Holiday.MOV', 'mp4')).toBe('My Holiday-framelab.mp4');
    expect(outputFilename('noext', 'mp4')).toBe('noext-framelab.mp4');
    expect(outputFilename('a.b.webm', 'mp4')).toMatch(/-framelab\.mp4$/);
  });
});
