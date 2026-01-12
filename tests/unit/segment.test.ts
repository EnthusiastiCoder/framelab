// U19 segment: src/subtitles/segment.ts (PURE)
// API: segmentChunks(chunks: Array<{ text: string; timestamp: [number, number | null] }>): Cue[]
//   (the transformers.js ASR chunk shape) -> cues of at most 2 lines x 42 chars, 0.8 s <= duration <= 7 s
//   (minimum only when there is room), monotonic, no overlap; empty chunks dropped; 3+ identical consecutive texts collapse.
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/subtitles/segment');

type Cue = { start: number; end: number; text: string };

const LONG =
  'Hello and welcome to Framelab, where everything runs in your browser. Your files never leave your device, ever, at all.';

function assertWellFormed(cues: Cue[]) {
  for (const c of cues) {
    const lines = c.text.split('\n');
    expect(lines.length, c.text).toBeLessThanOrEqual(2);
    for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(42);
    expect(c.end - c.start).toBeLessThanOrEqual(7 + 1e-9);
    expect(c.end).toBeGreaterThan(c.start);
  }
  for (let i = 1; i < cues.length; i++) expect(cues[i].start).toBeGreaterThanOrEqual(cues[i - 1].end - 1e-9);
}

const words = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('U19 segment', () => {
  it('the long fixture sentence is 115 to 125 characters', () => {
    expect(LONG.length).toBeGreaterThanOrEqual(115);
    expect(LONG.length).toBeLessThanOrEqual(125);
  });

  it('a 120-character, 9 s chunk splits into well-formed cues', async () => {
    const { segmentChunks } = await load();
    const cues: Cue[] = segmentChunks([{ text: LONG, timestamp: [0, 9] }]);
    expect(cues.length).toBeGreaterThanOrEqual(2);
    assertWellFormed(cues);
    expect(cues[0].start).toBeCloseTo(0, 6);
    expect(cues[cues.length - 1].end).toBeCloseTo(9, 6);
    expect(words(cues.map((c) => c.text).join(' '))).toBe(words(LONG));
  });

  it('splits at punctuation first', async () => {
    const { segmentChunks } = await load();
    const cues: Cue[] = segmentChunks([{ text: LONG, timestamp: [0, 9] }]);
    expect(cues[0].text.replace(/\n/g, ' ')).toMatch(/[.,]$/);
  });

  it('extends a 0.3 s cue to 0.8 s when there is room', async () => {
    const { segmentChunks } = await load();
    const cues: Cue[] = segmentChunks([
      { text: 'Hi.', timestamp: [1.0, 1.3] },
      { text: 'Next sentence here.', timestamp: [3.0, 5.0] },
    ]);
    expect(cues).toHaveLength(2);
    expect(cues[0].start).toBeCloseTo(1.0, 6);
    expect(cues[0].end - cues[0].start).toBeCloseTo(0.8, 6);
    assertWellFormed(cues);
  });

  it('does not extend into the next cue when there is no room', async () => {
    const { segmentChunks } = await load();
    const cues: Cue[] = segmentChunks([
      { text: 'Hi.', timestamp: [1.0, 1.3] },
      { text: 'Right after.', timestamp: [1.5, 3.0] },
    ]);
    expect(cues[0].end).toBeLessThanOrEqual(cues[1].start + 1e-9);
  });

  it('collapses a run of 3 or more identical texts into one cue', async () => {
    const { segmentChunks } = await load();
    const cues: Cue[] = segmentChunks([
      { text: 'Real speech.', timestamp: [0, 2] },
      { text: ' Thank you.', timestamp: [2, 3] },
      { text: ' Thank you.', timestamp: [3, 4] },
      { text: ' Thank you.', timestamp: [4, 5] },
      { text: ' Thank you.', timestamp: [5, 6] },
    ]);
    expect(cues.map((c) => c.text)).toEqual(['Real speech.', 'Thank you.']);
  });

  it('keeps a text repeated only twice', async () => {
    const { segmentChunks } = await load();
    const cues: Cue[] = segmentChunks([
      { text: 'No.', timestamp: [0, 1] },
      { text: 'No.', timestamp: [1, 2] },
    ]);
    expect(cues).toHaveLength(2);
  });

  it('drops empty chunks and handles a null end timestamp', async () => {
    const { segmentChunks } = await load();
    const cues: Cue[] = segmentChunks([
      { text: '   ', timestamp: [0, 1] },
      { text: 'Last words.', timestamp: [1, null] },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Last words.');
    expect(cues[0].end).toBeGreaterThan(cues[0].start);
  });
});
