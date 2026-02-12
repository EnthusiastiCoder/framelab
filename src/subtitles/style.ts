/** How burned-in captions look. Sizes are fractions of the frame height so they scale with resolution. */
export interface CaptionStyle {
  position: 'top' | 'bottom';
  /** Gap between the caption box and the frame edge, as a fraction of frame height. */
  margin: number;
  /** Font size as a fraction of frame height. */
  fontScale: number;
  textColor: string;
  /** Background box colour (CSS colour; use a transparent colour for none). */
  boxColor: string;
  /** Text outline width as a fraction of the font size (0 for none). */
  outline: number;
}

export const DEFAULT_STYLE: CaptionStyle = {
  position: 'bottom',
  margin: 0.06,
  fontScale: 0.05,
  textColor: '#ffffff',
  boxColor: 'rgba(0, 0, 0, 0.62)',
  outline: 0.08,
};

/** The font stack the burner draws with (Inter is self-hosted when available). */
export const CAPTION_FONT_FAMILY = 'Inter, "Segoe UI", Roboto, Arial, sans-serif';
export const LINE_HEIGHT = 1.25;
/** The text must fit within this fraction of the frame width. */
export const SAFE_WIDTH = 0.9;

export interface CaptionLayout {
  lines: string[];
  fontPx: number;
  lineHeightPx: number;
  box: { x: number; y: number; width: number; height: number };
}

export interface LayoutInput {
  text: string;
  frameWidth: number;
  frameHeight: number;
  style: CaptionStyle;
  /** Width in px of `text` at `fontPx` (injected so the layout stays pure and testable). */
  measure: (text: string, fontPx: number) => number;
}

/** Greedy word wrap of each source line within maxWidth. A single over-long word keeps its own line. */
function wrap(text: string, fontPx: number, maxWidth: number, measure: LayoutInput['measure']): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word;
      if (!cur || measure(next, fontPx) <= maxWidth) cur = next;
      else {
        out.push(cur);
        cur = word;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

/** Lays out a caption: wrapped lines, font size and the background box, centred horizontally. */
export function layoutCaption({ text, frameWidth, frameHeight, style, measure }: LayoutInput): CaptionLayout {
  const fontPx = frameHeight * style.fontScale;
  const lineHeightPx = fontPx * LINE_HEIGHT;
  const padX = fontPx * 0.4;
  const padY = fontPx * 0.2;
  const safe = SAFE_WIDTH * frameWidth;
  const lines = wrap(text, fontPx, safe, measure);
  const textWidth = Math.max(0, ...lines.map((l) => measure(l, fontPx)));
  const width = Math.min(frameWidth, textWidth + 2 * padX);
  const height = lines.length * lineHeightPx + 2 * padY;
  const x = (frameWidth - width) / 2;
  const marginPx = style.margin * frameHeight;
  const y = style.position === 'top' ? marginPx : Math.max(0, frameHeight - marginPx - height);
  return { lines, fontPx, lineHeightPx, box: { x, y, width, height } };
}
