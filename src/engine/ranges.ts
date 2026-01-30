// PURE keep-range math for cut (remove sections). The mediabunny pipeline (mediabunny/ranges.ts) uses it.

export type Range = [number, number];

/** Normalises removals (sorted, clamped, merged) and returns the ranges that are kept, in order. */
export function keepRanges(durationSec: number, removals: Range[]): Range[] {
  const clamp = (t: number) => Math.min(durationSec, Math.max(0, t));
  const norm = removals
    .map(([a, b]) => [clamp(Math.min(a, b)), clamp(Math.max(a, b))] as Range)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const merged: Range[] = [];
  for (const r of norm) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const keep: Range[] = [];
  let t = 0;
  for (const [a, b] of merged) {
    if (a > t) keep.push([t, a]);
    t = b;
  }
  if (t < durationSec) keep.push([t, durationSec]);
  return keep;
}

export function rangesDuration(ranges: Range[]): number {
  return ranges.reduce((s, [a, b]) => s + (b - a), 0);
}
