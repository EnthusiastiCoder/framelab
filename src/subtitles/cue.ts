/** A subtitle cue. Times are in seconds; multi-line text is joined by '\n'. */
export interface Cue {
  start: number;
  end: number;
  text: string;
  /** Raw WebVTT cue settings, e.g. "align:start line:10%". */
  settings?: string;
}

/** Strips a UTF-8 BOM and normalises CRLF / CR line endings to LF. */
export function normaliseText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

/** Formats seconds as hh:mm:ss<sep>mmm. */
export function formatTimestamp(seconds: number, sep: ',' | '.'): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalS = Math.floor(totalMs / 1000);
  const s = totalS % 60;
  const m = Math.floor(totalS / 60) % 60;
  const h = Math.floor(totalS / 3600);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${p2(h)}:${p2(m)}:${p2(s)}${sep}${String(ms).padStart(3, '0')}`;
}

/** Parses hh:mm:ss,mmm, hh:mm:ss.mmm or mm:ss.mmm into seconds; NaN when malformed. */
export function parseTimestamp(text: string): number {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/.exec(text.trim());
  if (!m) return NaN;
  const h = m[1] ? Number(m[1]) : 0;
  const ms = Number(m[4].padEnd(3, '0'));
  return Math.round((h * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000 + ms) / 1000;
}
