// PURE timecode helpers: "hh:mm:ss.mmm", "mm:ss" and plain seconds.

const NUM = /^\d+(?:\.\d+)?$/;
const INT = /^\d+$/;

/** Parses "h:mm:ss.mmm", "mm:ss(.mmm)" or "ss(.mmm)" into seconds. Throws on anything else. */
export function parse(text: string): number {
  const t = String(text ?? '').trim();
  if (!t) throw new Error('empty timecode');
  const parts = t.split(':');
  if (parts.length > 3) throw new Error(`too many fields in timecode "${t}"`);
  const last = parts[parts.length - 1];
  if (!NUM.test(last)) throw new Error(`invalid seconds in timecode "${t}"`);
  const leading = parts.slice(0, -1);
  for (const p of leading) if (!INT.test(p)) throw new Error(`invalid field in timecode "${t}"`);
  const seconds = Number(last);
  if (leading.length > 0 && seconds >= 60) throw new Error(`seconds out of range in "${t}"`);
  if (leading.length === 2 && Number(leading[1]) >= 60) throw new Error(`minutes out of range in "${t}"`);
  let total = seconds;
  let mult = 60;
  for (let i = leading.length - 1; i >= 0; i--) {
    total += Number(leading[i]) * mult;
    mult *= 60;
  }
  return total;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Formats seconds as "hh:mm:ss.mmm". */
export function format(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/** Snaps a time to the nearest frame boundary at the given frame rate. */
export function snapToFrame(seconds: number, fps: number): number {
  if (!(fps > 0)) return seconds;
  return Math.round(seconds * fps) / fps;
}
