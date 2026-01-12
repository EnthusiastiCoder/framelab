// U18 vtt: src/subtitles/vtt.ts (PURE)
// API: serializeVtt(cues: Cue[]): string;  parseVtt(text: string): Cue[]
//   Cue = { start: number; end: number; text: string; settings?: string }   (settings = the raw cue settings, e.g. "align:start line:10%")
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const load = () => import('../../src/subtitles/vtt');
const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

describe('U18 vtt', () => {
  it('serialises with the WEBVTT header and dotted milliseconds', async () => {
    const { serializeVtt } = await load();
    const out = serializeVtt([{ start: 1, end: 2.5, text: 'Hello' }]);
    expect(out.startsWith('WEBVTT\n\n')).toBe(true);
    expect(out).toContain('00:00:01.000 --> 00:00:02.500\nHello\n');
  });

  it('parses sample.vtt into 3 cues', async () => {
    const { parseVtt } = await load();
    const cues = parseVtt(fixture('sample.vtt'));
    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject({ start: 0.5, end: 1.8, text: 'Hello and welcome to Framelab.' });
    expect(cues[1].settings).toBe('align:start line:10%');
  });

  it('cue settings survive a round-trip', async () => {
    const { parseVtt, serializeVtt } = await load();
    const out = serializeVtt(parseVtt(fixture('sample.vtt')));
    expect(out).toContain('00:00:02.000 --> 00:00:03.400 align:start line:10%\n');
    expect(parseVtt(out)).toEqual(parseVtt(fixture('sample.vtt')));
  });

  it('ignores NOTE blocks and cue identifiers, and tolerates CRLF and a BOM', async () => {
    const { parseVtt } = await load();
    const text = '﻿WEBVTT\r\n\r\nNOTE a comment\r\n\r\ncue-1\r\n00:01.000 --> 00:02.000\r\nHi\r\n\r\n';
    const cues = parseVtt(text);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 1, end: 2, text: 'Hi' });
  });

  it('rejects text without the WEBVTT header', async () => {
    const { parseVtt } = await load();
    expect(() => parseVtt('00:00:01.000 --> 00:00:02.000\nHi\n')).toThrow();
  });
});
