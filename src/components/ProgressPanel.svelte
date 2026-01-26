<script lang="ts">
  // Job progress: phase, percent, ETA and a Cancel button.
  import type { Progress } from '../engine/types';

  interface Props {
    progress: Progress | null;
    oncancel: () => void;
  }

  let { progress, oncancel }: Props = $props();

  const PHASE: Record<Progress['phase'], string> = {
    reading: 'Reading your file',
    processing: 'Processing',
    writing: 'Writing the output',
    done: 'Finishing',
  };

  const percent = $derived(Math.round(Math.max(0, Math.min(1, progress?.ratio ?? 0)) * 100));
  const eta = $derived(
    progress?.etaSeconds != null && Number.isFinite(progress.etaSeconds) ? `about ${Math.max(1, Math.round(progress.etaSeconds))} s left` : '',
  );
</script>

<div class="progress card" data-testid="progress" role="status" aria-live="polite">
  <div class="row">
    <span class="phase">{PHASE[progress?.phase ?? 'reading']}</span>
    <span class="pct">{percent}%{eta ? ` · ${eta}` : ''}</span>
  </div>
  <div class="bar" role="progressbar" aria-label="Job progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}>
    <div class="fill" style:width={`${percent}%`}></div>
  </div>
  <button type="button" class="btn btn-secondary" data-testid="cancel" onclick={oncancel}>Cancel</button>
</div>

<style>
  .progress {
    display: grid;
    gap: var(--space-3);
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    font-weight: 600;
  }
  .pct {
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }
  .bar {
    height: 10px;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width var(--duration) linear;
  }
  button {
    justify-self: start;
  }
</style>
