<script lang="ts">
  // Crop preview: the video with a draggable crop window. Drag the window to move it and the corner handle to
  // resize it; with a fixed aspect ratio the window keeps that ratio. Keyboard: arrow keys move it, Shift+arrows resize.
  import type { Rect } from '../engine/crop';

  interface Props {
    file: File;
    /** Source frame size in pixels. */
    width: number;
    height: number;
    /** Width / height ratio to lock to, or null for free. */
    ratio: number | null;
    rect: Rect;
    onchange: (rect: Rect) => void;
  }
  let { file, width, height, ratio, rect, onchange }: Props = $props();

  let src = $state('');
  $effect(() => {
    const url = URL.createObjectURL(file);
    src = url;
    return () => URL.revokeObjectURL(url);
  });

  let box: HTMLDivElement;
  let drag: { kind: 'move' | 'resize'; x: number; y: number; start: Rect } | null = null;

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  function clamp(r: Rect): Rect {
    let w = Math.max(16, Math.min(width, r.width));
    let h = Math.max(16, Math.min(height, r.height));
    if (ratio) {
      if (w / h > ratio) w = h * ratio;
      else h = w / ratio;
    }
    const x = Math.max(0, Math.min(width - w, r.x));
    const y = Math.max(0, Math.min(height - h, r.y));
    return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
  }

  function down(e: PointerEvent, kind: 'move' | 'resize') {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { kind, x: e.clientX, y: e.clientY, start: { ...rect } };
  }

  function move(e: PointerEvent) {
    if (!drag || !box) return;
    const scale = width / box.clientWidth;
    const dx = (e.clientX - drag.x) * scale;
    const dy = (e.clientY - drag.y) * scale;
    const s = drag.start;
    onchange(
      clamp(drag.kind === 'move' ? { ...s, x: s.x + dx, y: s.y + dy } : { ...s, width: s.width + dx, height: ratio ? (s.width + dx) / ratio : s.height + dy }),
    );
  }

  function up() {
    drag = null;
  }

  function key(e: KeyboardEvent) {
    const step = Math.max(2, Math.round(width / 100));
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    if (e.shiftKey) {
      const w = rect.width + v[0] - v[1];
      onchange(clamp({ ...rect, width: w, height: ratio ? w / ratio : rect.height + v[1] }));
    } else {
      onchange(clamp({ ...rect, x: rect.x + v[0], y: rect.y + v[1] }));
    }
  }
</script>

<div class="overlay" bind:this={box} style:aspect-ratio={`${width} / ${height}`} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation">
  {#if src}
    <video {src} muted playsinline preload="metadata" aria-hidden="true"></video>
  {/if}
  <div
    class="window"
    role="slider"
    tabindex="0"
    aria-label="Crop area. Arrow keys move it, Shift with arrow keys resizes it."
    aria-valuetext={`${rect.width} by ${rect.height} at ${rect.x}, ${rect.y}`}
    aria-valuenow={rect.x}
    style:left={pct(rect.x, width)}
    style:top={pct(rect.y, height)}
    style:width={pct(rect.width, width)}
    style:height={pct(rect.height, height)}
    onpointerdown={(e) => down(e, 'move')}
    onkeydown={key}
  >
    <span class="handle" onpointerdown={(e) => down(e, 'resize')} role="presentation"></span>
  </div>
</div>

<style>
  .overlay {
    position: relative;
    width: 100%;
    max-height: 420px;
    background: #000;
    border-radius: var(--radius-sm);
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: block;
  }
  .window {
    position: absolute;
    box-shadow: 0 0 0 9999px rgb(0 0 0 / 55%);
    outline: 2px solid #fff;
    cursor: move;
  }
  .window:focus-visible {
    outline: 3px solid var(--focus);
  }
  .handle {
    position: absolute;
    right: -8px;
    bottom: -8px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid var(--accent);
    cursor: nwse-resize;
  }
</style>
