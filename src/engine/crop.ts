// PURE resize/crop layout: which part of the input frame is used (source) and where it lands in the output (dest).
// Every output and rect dimension is even, because H.264/VP9 encoders need even sizes for 4:2:0 chroma.

export type Aspect = '9:16' | '1:1' | '4:5' | '16:9' | 'free';
export type CropMode = 'crop' | 'fit-pad' | 'fit-blur';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Layout {
  output: Size;
  source: Rect;
  dest: Rect;
}

export const ASPECTS: Record<Exclude<Aspect, 'free'>, number> = {
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
  '16:9': 16 / 9,
};

/** Nearest even integer, at least 2. */
export const evenRound = (n: number) => Math.max(2, 2 * Math.round(n / 2));
/** Largest even integer not above n, at least 2. */
export const evenFloor = (n: number) => Math.max(2, 2 * Math.floor(n / 2));

function cropLayout(src: Size, ratio: number): Layout {
  const maxW = evenFloor(src.width);
  const maxH = evenFloor(src.height);
  let width: number;
  let height: number;
  if (src.width / src.height > ratio) {
    height = maxH;
    width = Math.min(maxW, evenRound(height * ratio));
  } else {
    width = maxW;
    height = Math.min(maxH, evenRound(width / ratio));
  }
  const x = Math.round((src.width - width) / 2);
  const y = Math.round((src.height - height) / 2);
  return {
    output: { width, height },
    source: { x, y, width, height },
    dest: { x: 0, y: 0, width, height },
  };
}

function fitLayout(src: Size, ratio: number): Layout {
  const source: Rect = { x: 0, y: 0, width: evenFloor(src.width), height: evenFloor(src.height) };
  let output: Size;
  if (ratio === 1) {
    const side = evenFloor(Math.min(src.width, src.height));
    output = { width: side, height: side };
  } else {
    // The output keeps the source's long side along the target's long axis (1920x1080 -> 9:16 = 1080x1920).
    const long = evenFloor(Math.max(src.width, src.height));
    output = ratio < 1 ? { width: evenRound(long * ratio), height: long } : { width: long, height: evenRound(long / ratio) };
  }
  const scale = Math.min(output.width / source.width, output.height / source.height);
  const dw = Math.min(output.width, evenRound(source.width * scale));
  const dh = Math.min(output.height, evenRound(source.height * scale));
  const dest: Rect = {
    x: Math.round((output.width - dw) / 2),
    y: Math.round((output.height - dh) / 2),
    width: dw,
    height: dh,
  };
  return { output, source, dest };
}

function freeLayout(src: Size, rect: Rect | undefined): Layout {
  const r = rect ?? { x: 0, y: 0, width: src.width, height: src.height };
  const x = Math.min(Math.max(0, Math.round(r.x)), src.width - 2);
  const y = Math.min(Math.max(0, Math.round(r.y)), src.height - 2);
  const right = Math.min(src.width, Math.round(r.x + r.width));
  const bottom = Math.min(src.height, Math.round(r.y + r.height));
  const width = Math.min(evenFloor(right - x), 2 * Math.floor((src.width - x) / 2));
  const height = Math.min(evenFloor(bottom - y), 2 * Math.floor((src.height - y) / 2));
  return {
    output: { width, height },
    source: { x, y, width, height },
    dest: { x: 0, y: 0, width, height },
  };
}

export function layoutFor(src: Size, opts: { aspect: Aspect; mode: CropMode; rect?: Rect }): Layout {
  if (opts.aspect === 'free') return freeLayout(src, opts.rect);
  const ratio = ASPECTS[opts.aspect];
  return opts.mode === 'crop' ? cropLayout(src, ratio) : fitLayout(src, ratio);
}
