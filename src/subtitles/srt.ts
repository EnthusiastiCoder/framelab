import { formatTimestamp, normaliseText, parseTimestamp, type Cue } from './cue';

export type { Cue } from './cue';

/** Serialises cues to SubRip text, numbered from 1, each block followed by a blank line. */
export function serializeSrt(cues: Cue[]): string {
  return cues
    .map(
      (c, i) =>
        `${i + 1}\n${formatTimestamp(c.start, ',')} --> ${formatTimestamp(c.end, ',')}\n${c.text}\n\n`,
    )
    .join('');
}

const TIMING = /^\s*(\S+)\s+-->\s+(\S+)/;

/** Parses SubRip text. Tolerates a BOM, CRLF, missing index lines and extra blank lines. */
export function parseSrt(text: string): Cue[] {
  const blocks = normaliseText(text).split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l, i, a) => !(l.trim() === '' && (i === 0 || i === a.length - 1)));
    const timingIdx = lines.findIndex((l) => TIMING.test(l));
    if (timingIdx < 0) continue;
    const m = TIMING.exec(lines[timingIdx])!;
    const start = parseTimestamp(m[1]);
    const end = parseTimestamp(m[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const body = lines.slice(timingIdx + 1).join('\n').trim();
    if (!body) continue;
    cues.push({ start, end, text: body });
  }
  return cues;
}
