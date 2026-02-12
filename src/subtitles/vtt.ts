import { formatTimestamp, normaliseText, parseTimestamp, type Cue } from './cue';

export type { Cue } from './cue';

/** Serialises cues to WebVTT, keeping any raw cue settings after the timing line. */
export function serializeVtt(cues: Cue[]): string {
  const body = cues
    .map((c) => {
      const timing = `${formatTimestamp(c.start, '.')} --> ${formatTimestamp(c.end, '.')}`;
      const settings = c.settings?.trim() ? ` ${c.settings.trim()}` : '';
      return `${timing}${settings}\n${c.text}\n`;
    })
    .join('\n');
  return `WEBVTT\n\n${body}`;
}

const TIMING = /^\s*(\S+)\s+-->\s+(\S+)(?:\s+(.*))?$/;

/** Parses WebVTT. Requires the WEBVTT header; skips NOTE, STYLE and REGION blocks and cue identifiers. */
export function parseVtt(text: string): Cue[] {
  const norm = normaliseText(text);
  if (!/^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(norm)) throw new Error('Not a WebVTT file: the WEBVTT header is missing.');
  const blocks = norm.split(/\n{2,}/).slice(1);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.length > 0 || false);
    if (lines.length === 0) continue;
    if (/^(NOTE|STYLE|REGION)(\s|$)/.test(lines[0])) continue;
    const timingIdx = lines.findIndex((l) => l.includes('-->'));
    if (timingIdx < 0 || timingIdx > 1) continue;
    const m = TIMING.exec(lines[timingIdx]);
    if (!m) continue;
    const start = parseTimestamp(m[1]);
    const end = parseTimestamp(m[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const textBody = lines.slice(timingIdx + 1).join('\n').trim();
    if (!textBody) continue;
    const cue: Cue = { start, end, text: textBody };
    const settings = m[3]?.trim();
    if (settings) cue.settings = settings;
    cues.push(cue);
  }
  return cues;
}
