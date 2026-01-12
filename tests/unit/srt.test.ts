// U17 srt: src/subtitles/srt.ts (PURE)
// API: serializeSrt(cues: Cue[]): string;  parseSrt(text: string): Cue[]
//   Cue = { start: number; end: number; text: string; settings?: string }   (seconds; multi-line text joined by '\n')
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const load = () => import('../../src/subtitles/srt');
const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

describe('U17 srt', () => {
  it('serialises one cue exactly', async () => {
    const { serializeSrt } = await load();
    expect(serializeSrt([{ start: 1, end: 2.5, text: 'Hello' }])).toBe('1\n00:00:01,000 --> 00:00:02,500\nHello\n\n');
  });

  it('numbers cues from 1 and formats hours', async () => {
    const { serializeSrt } = await load();
    const out = serializeSrt([
      { start: 0, end: 1, text: 'A' },
      { start: 3723.45, end: 3724, text: 'B\nC' },
    ]);
    expect(out).toBe('1\n00:00:00,000 --> 00:00:01,000\nA\n\n2\n01:02:03,450 --> 01:02:04,000\nB\nC\n\n');
  });

  it('parses sample.srt into 3 cues', async () => {
    const { parseSrt } = await load();
    const cues = parseSrt(fixture('sample.srt'));
    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject({ start: 0.5, end: 1.8, text: 'Hello and welcome to Framelab.' });
    expect(cues[1].text).toBe('Everything here runs\nin your browser.');
  });

  it('parse -> serialise round-trip is identical for sample.srt', async () => {
    const { parseSrt, serializeSrt } = await load();
    const text = fixture('sample.srt');
    expect(serializeSrt(parseSrt(text))).toBe(text);
  });

  it('tolerates CRLF line endings and a BOM', async () => {
    const { parseSrt } = await load();
    const lf = fixture('sample.srt');
    const crlfBom = '﻿' + lf.replace(/\n/g, '\r\n');
    expect(parseSrt(crlfBom)).toEqual(parseSrt(lf));
  });
});
