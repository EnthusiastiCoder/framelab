<script lang="ts">
  // Waveform of an audio file (peaks computed in the engine worker) with the selected range highlighted.
  // Clicking moves the nearer range edge to that point.

  interface Props {
    peaks: Float32Array | null;
    duration: number;
    start: number;
    end: number;
    onpick?: (edge: 'start' | 'end', seconds: number) => void;
  }
  let { peaks, duration, start, end, onpick }: Props = $props();

  const W = 600;
  const H = 96;

  const bars = $derived(
    peaks
      ? Array.from(peaks, (p, i) => {
          const h = Math.max(1, p * (H - 4));
          return { x: (i / peaks.length) * W, h };
        })
      : [],
  );
  const barWidth = $derived(peaks && peaks.length > 0 ? Math.max(0.5, W / peaks.length - 0.3) : 1);
  const x0 = $derived(duration > 0 ? (Math.max(0, start) / duration) * W : 0);
  const x1 = $derived(duration > 0 ? (Math.min(duration, end) / duration) * W : W);

  function pick(e: MouseEvent) {
    if (!onpick || !(duration > 0)) return;
    const svg = e.currentTarget as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    const t = Math.max(0, Math.min(duration, ((e.clientX - box.left) / box.width) * duration));
    onpick(Math.abs(t - start) <= Math.abs(t - end) ? 'start' : 'end', Math.round(t * 100) / 100);
  }
</script>

<figure class="wave">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Audio waveform with the selected range highlighted" onclick={pick}>
    <rect x={x0} y="0" width={Math.max(0, x1 - x0)} height={H} class="range" />
    {#each bars as b}
      <rect x={b.x} y={(H - b.h) / 2} width={barWidth} height={b.h} class="bar" />
    {/each}
  </svg>
  {#if !peaks}
    <figcaption class="muted">Drawing the waveform…</figcaption>
  {:else}
    <figcaption class="muted">Click the waveform to move the nearer edge of the range. The start and end fields below set it exactly.</figcaption>
  {/if}
</figure>

<style>
  .wave {
    margin: 0;
  }
  svg {
    width: 100%;
    height: 96px;
    display: block;
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .bar {
    fill: var(--text-muted);
  }
  .range {
    fill: var(--accent-soft);
  }
  figcaption {
    font-size: 0.85rem;
    margin-top: var(--space-1);
  }
</style>
