// U12 ranges: src/engine/ranges.ts (PURE; the mediabunny pipeline in src/engine/mediabunny/ranges.ts uses it)
// API: keepRanges(durationSec: number, removals: Array<[number, number]>): Array<[number, number]>
//      rangesDuration(ranges: Array<[number, number]>): number
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/engine/ranges');

describe('U12 keep ranges', () => {
  it('removing [1,2] and [3,3.5] from 5 s keeps [0,1],[2,3],[3.5,5] for 3.5 s', async () => {
    const { keepRanges, rangesDuration } = await load();
    const keep = keepRanges(5, [[1, 2], [3, 3.5]]);
    expect(keep).toEqual([[0, 1], [2, 3], [3.5, 5]]);
    expect(rangesDuration(keep)).toBeCloseTo(3.5, 9);
  });

  it('normalises unsorted removals', async () => {
    const { keepRanges } = await load();
    expect(keepRanges(5, [[3, 3.5], [1, 2]])).toEqual([[0, 1], [2, 3], [3.5, 5]]);
  });

  it('merges overlapping removals', async () => {
    const { keepRanges } = await load();
    expect(keepRanges(5, [[1, 2.5], [2, 3]])).toEqual([[0, 1], [3, 5]]);
  });

  it('normalises reversed and out-of-bounds removals', async () => {
    const { keepRanges } = await load();
    expect(keepRanges(5, [[2, 1], [4, 9], [-1, 0.5]])).toEqual([[0.5, 1], [2, 4]]);
  });

  it('no removals keeps the whole clip', async () => {
    const { keepRanges } = await load();
    expect(keepRanges(5, [])).toEqual([[0, 5]]);
  });
});
