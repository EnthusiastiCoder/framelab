<script lang="ts">
  // The size notice shown before a speech model download (decision 3: same-origin, on demand). No download
  // starts until the user presses Download; "Remember my choice" skips this notice next time.
  import { onMount } from 'svelte';
  import { noticeText } from '../subtitles/download-gate';
  import type { WhisperModel } from '../subtitles/models';

  interface Props {
    model: WhisperModel;
    cached: boolean;
    ondownload: (remember: boolean) => void;
    oncancel: () => void;
  }

  let { model, cached, ondownload, oncancel }: Props = $props();
  let remember = $state(false);
  let first: HTMLButtonElement;

  onMount(() => first?.focus());

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      oncancel();
    }
  }
</script>

<div class="notice card" data-testid="model-notice" role="dialog" aria-labelledby="model-notice-title" aria-describedby="model-notice-text" tabindex="-1" {onkeydown}>
  <h2 id="model-notice-title" class="title">Download the speech model?</h2>
  <p id="model-notice-text">{noticeText(model, cached)}</p>
  <p class="muted small">Model: {model.label}</p>
  <label class="remember">
    <input type="checkbox" bind:checked={remember} />
    Remember my choice
  </label>
  <div class="actions">
    <button type="button" class="btn" bind:this={first} onclick={() => ondownload(remember)}>Download</button>
    <button type="button" class="btn btn-secondary" onclick={oncancel}>Not now</button>
  </div>
</div>

<style>
  .notice {
    display: grid;
    gap: var(--space-2);
    border-color: var(--accent);
  }
  .title {
    margin: 0;
    font-size: 1.15rem;
  }
  .notice p {
    margin: 0;
  }
  .small {
    font-size: 0.9rem;
  }
  .remember {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
