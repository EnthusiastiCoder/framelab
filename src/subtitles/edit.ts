// Pure cue-list edits used by the subtitle editor. Each returns a new array; the editor keeps the undo history.

import type { Cue } from './cue';

export const NUDGE = 0.1;
/** Shortest cue an edit may leave. */
export const MIN_LENGTH = 0.1;

const round = (t: number) => Math.round(t * 1000) / 1000;

export function setText(cues: Cue[], i: number, text: string): Cue[] {
  return cues.map((c, j) => (j === i ? { ...c, text } : c));
}

/** Moves the start or end of cue i by delta seconds, keeping it at least MIN_LENGTH long and not below 0. */
export function nudge(cues: Cue[], i: number, edge: 'start' | 'end', delta: number): Cue[] {
  return cues.map((c, j) => {
    if (j !== i) return c;
    if (edge === 'start') return { ...c, start: round(Math.max(0, Math.min(c.end - MIN_LENGTH, c.start + delta))) };
    return { ...c, end: round(Math.max(c.start + MIN_LENGTH, c.end + delta)) };
  });
}

/**
 * Splits cue i at character `at` of its text. The time is shared out by character count. When the cursor is at
 * either end, the cue splits at the word nearest its middle instead.
 */
export function split(cues: Cue[], i: number, at: number): Cue[] {
  const c = cues[i];
  if (!c) return cues;
  const text = c.text;
  let pos = Math.max(0, Math.min(text.length, at));
  if (text.slice(0, pos).trim() === '' || text.slice(pos).trim() === '') {
    const mid = text.length / 2;
    let best = -1;
    for (let k = 0; k < text.length; k++) if (/\s/.test(text[k]) && (best < 0 || Math.abs(k - mid) < Math.abs(best - mid))) best = k;
    if (best < 0) return cues;
    pos = best;
  }
  const a = text.slice(0, pos).trim();
  const b = text.slice(pos).trim();
  if (!a || !b) return cues;
  const t = round(c.start + ((c.end - c.start) * a.length) / (a.length + b.length));
  return [...cues.slice(0, i), { ...c, end: t, text: a }, { ...c, start: t, text: b }, ...cues.slice(i + 1)];
}

/** Joins cue i with the next one. */
export function mergeNext(cues: Cue[], i: number): Cue[] {
  const a = cues[i];
  const b = cues[i + 1];
  if (!a || !b) return cues;
  const merged: Cue = { ...a, end: Math.max(a.end, b.end), text: `${a.text.trim()} ${b.text.trim()}`.trim() };
  return [...cues.slice(0, i), merged, ...cues.slice(i + 2)];
}

export function remove(cues: Cue[], i: number): Cue[] {
  return cues.filter((_, j) => j !== i);
}

/** Bounded undo/redo stacks of cue lists. */
export class History {
  private past: Cue[][] = [];
  private future: Cue[][] = [];
  constructor(private readonly limit = 200) {}

  /** Records `current` before a change. */
  record(current: Cue[]) {
    this.past.push(current);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo(current: Cue[]): Cue[] | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(current);
    return prev;
  }

  redo(current: Cue[]): Cue[] | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(current);
    return next;
  }

  clear() {
    this.past = [];
    this.future = [];
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }
}

/** m:ss.s for the editor display. */
export function displayTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
