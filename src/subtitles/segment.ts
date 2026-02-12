import type { Cue } from './cue';

/** The transformers.js ASR chunk shape: text plus [start, end] seconds (end may be null on the last chunk). */
export interface AsrChunk {
  text: string;
  timestamp: [number, number | null];
}

export const MAX_LINE_CHARS = 42;
export const MAX_LINES = 2;
export const MAX_CUE_SECONDS = 7;
export const MIN_CUE_SECONDS = 0.8;
const EPS = 1e-9;

/** Wraps text into at most two balanced lines of MAX_LINE_CHARS, or returns null when it does not fit. */
export function wrapTwoLines(text: string): string[] | null {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_LINE_CHARS) return [t];
  let best: string[] | null = null;
  let bestScore = Infinity;
  for (let i = t.indexOf(' '); i >= 0; i = t.indexOf(' ', i + 1)) {
    const a = t.slice(0, i);
    const b = t.slice(i + 1);
    if (a.length > MAX_LINE_CHARS || b.length > MAX_LINE_CHARS) continue;
    const score = Math.max(a.length, b.length);
    if (score < bestScore) {
      bestScore = score;
      best = [a, b];
    }
  }
  return best;
}

const fits = (text: string) => wrapTwoLines(text) !== null;

/** Splits text into phrases that end at punctuation (the preferred break points). */
function phrases(text: string): string[] {
  return text.match(/[^.,!?;:]+[.,!?;:]+["')\]]*|[^.,!?;:]+$/g)?.map((p) => p.trim()).filter(Boolean) ?? [];
}

/** Splits an over-long run of words into pieces that each fit on two lines. */
function splitWords(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (fits(next) || !cur) cur = next;
    else {
      out.push(cur);
      cur = word;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Packs phrases greedily into pieces that fit two lines, breaking at punctuation first and words second. */
function packText(text: string): string[] {
  const pieces: string[] = [];
  let cur = '';
  for (const phrase of phrases(text)) {
    const parts = fits(phrase) ? [phrase] : splitWords(phrase);
    for (const part of parts) {
      const next = cur ? `${cur} ${part}` : part;
      if (fits(next)) cur = next;
      else {
        if (cur) pieces.push(cur);
        cur = part;
      }
    }
  }
  if (cur) pieces.push(cur);
  return pieces;
}

/** Splits a piece into two near-equal halves by words, preferring a punctuation break. */
function halve(text: string): [string, string] | null {
  const words = text.split(' ');
  if (words.length < 2) return null;
  let bestIdx = -1;
  let bestScore = Infinity;
  let pos = 0;
  for (let i = 0; i < words.length - 1; i++) {
    pos += words[i].length + 1;
    const balance = Math.abs(pos - (text.length - pos));
    const score = balance - (/[.,!?;:]$/.test(words[i]) ? text.length / 4 : 0);
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return [words.slice(0, bestIdx + 1).join(' '), words.slice(bestIdx + 1).join(' ')];
}

/** Shares [start, end] out over the pieces by character count. */
function timePieces(pieces: string[], start: number, end: number): Cue[] {
  const total = pieces.reduce((n, p) => n + p.length, 0) || 1;
  const span = end - start;
  const cues: Cue[] = [];
  let acc = 0;
  for (let i = 0; i < pieces.length; i++) {
    const s = start + (span * acc) / total;
    acc += pieces[i].length;
    const e = i === pieces.length - 1 ? end : start + (span * acc) / total;
    cues.push({ start: s, end: e, text: pieces[i] });
  }
  return cues;
}

/** Times the pieces of one chunk, halving any piece that would run longer than MAX_CUE_SECONDS. */
function timeChunk(text: string, start: number, end: number): Cue[] {
  let pieces = packText(text);
  for (let guard = 0; guard < 64; guard++) {
    const cues = timePieces(pieces, start, end);
    const longIdx = cues.findIndex((c) => c.end - c.start > MAX_CUE_SECONDS + EPS && c.text.includes(' '));
    if (longIdx < 0) return cues;
    const halves = halve(pieces[longIdx])!;
    pieces = [...pieces.slice(0, longIdx), ...halves, ...pieces.slice(longIdx + 1)];
  }
  return timePieces(pieces, start, end);
}

/**
 * Turns ASR chunks into readable cues: at most 2 lines x 42 characters and 7 s each, monotonic,
 * non-overlapping, at least 0.8 s when there is room. Empty chunks are dropped and runs of 3 or more
 * identical texts (a common Whisper hallucination) collapse into one cue.
 */
export function segmentChunks(chunks: AsrChunk[]): Cue[] {
  const clean = chunks
    .map((c) => ({ text: c.text.replace(/\s+/g, ' ').trim(), start: c.timestamp[0], end: c.timestamp[1] }))
    .filter((c) => c.text.length > 0 && Number.isFinite(c.start));

  // Collapse runs of 3+ identical texts into the first of the run.
  const collapsed: typeof clean = [];
  for (let i = 0; i < clean.length; ) {
    let j = i + 1;
    while (j < clean.length && clean[j].text === clean[i].text) j++;
    if (j - i >= 3) collapsed.push(clean[i]);
    else collapsed.push(...clean.slice(i, j));
    i = j;
  }

  const cues: Cue[] = [];
  for (let i = 0; i < collapsed.length; i++) {
    const c = collapsed[i];
    let end = c.end;
    if (end === null || !Number.isFinite(end) || end <= c.start) {
      const nextStart = collapsed[i + 1]?.start;
      const guess = Math.min(MAX_CUE_SECONDS, Math.max(1, c.text.length * 0.07));
      end = nextStart !== undefined && nextStart > c.start ? Math.min(nextStart, c.start + guess) : c.start + guess;
    }
    cues.push(...timeChunk(c.text, c.start, end));
  }

  // Remove overlaps and keep the order monotonic.
  for (let i = 1; i < cues.length; i++) {
    const prev = cues[i - 1];
    const cur = cues[i];
    if (cur.start < prev.end) {
      if (cur.start > prev.start) prev.end = cur.start;
      else cur.start = prev.end;
    }
    if (cur.end <= cur.start) cur.end = cur.start + MIN_CUE_SECONDS;
  }

  // Extend short cues to the minimum only when there is room before the next cue.
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    if (c.end - c.start < MIN_CUE_SECONDS) {
      const limit = cues[i + 1]?.start ?? Infinity;
      c.end = Math.max(c.end, Math.min(c.start + MIN_CUE_SECONDS, limit));
    }
  }

  return cues.map((c) => ({ start: c.start, end: c.end, text: (wrapTwoLines(c.text) ?? [c.text]).join('\n') }));
}
