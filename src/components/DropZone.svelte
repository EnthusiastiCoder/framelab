<script lang="ts">
  // File drop zone: drag and drop, click, or keyboard (Enter/Space opens the file chooser).
  interface Props {
    accept?: string;
    multiple?: boolean;
    label?: string;
    hint?: string;
    disabled?: boolean;
    /** A tiny bundled sample (same origin) offered in the empty state as "Try a sample file". */
    sample?: { url: string; name: string; type: string };
    onfiles: (files: File[]) => void;
  }

  let {
    accept = 'video/*',
    multiple = false,
    label = 'Drop a video here',
    hint = 'or click to choose a file',
    disabled = false,
    sample,
    onfiles,
  }: Props = $props();

  let loadingSample = $state(false);

  async function trySample() {
    if (!sample || disabled || loadingSample) return;
    loadingSample = true;
    try {
      const res = await fetch(sample.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      onfiles([new File([blob], sample.name, { type: sample.type })]);
    } catch {
      window.dispatchEvent(new CustomEvent('framelab:toast', { detail: { message: 'The sample file could not be loaded.' } }));
    } finally {
      loadingSample = false;
    }
  }

  let input: HTMLInputElement;
  let dragging = $state(false);

  function open() {
    if (!disabled) input.click();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  }

  function take(list: FileList | null | undefined) {
    const files = list ? Array.from(list) : [];
    if (files.length) onfiles(multiple ? files : files.slice(0, 1));
  }

  function ondrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    if (!disabled) take(e.dataTransfer?.files);
  }
</script>

<div class="dropzone-root" data-testid="dropzone">
<div
  class="dropzone"
  class:dragging
  class:disabled
  role="button"
  tabindex="0"
  aria-disabled={disabled}
  aria-label={`${label}, ${hint}`}
  onclick={open}
  {onkeydown}
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  {ondrop}
>
  <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    ><path d="M12 16V4m0 0-4 4m4-4 4 4"></path><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path></svg
  >
  <span class="label">{label}</span>
  <span class="hint">{hint}</span>
</div>
<input
  bind:this={input}
  type="file"
  {accept}
  {multiple}
  tabindex="-1"
  aria-hidden="true"
  class="visually-hidden"
  onclick={(e) => e.stopPropagation()}
  onchange={(e) => {
    take((e.currentTarget as HTMLInputElement).files);
    (e.currentTarget as HTMLInputElement).value = '';
  }}
/>
{#if sample}
  <button type="button" class="btn btn-secondary sample" disabled={disabled || loadingSample} onclick={trySample}>
    {loadingSample ? 'Loading the sample…' : 'Try a sample file'}
  </button>
{/if}
</div>

<style>
  .dropzone-root {
    position: relative;
  }
  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 200px;
    padding: var(--space-6) var(--space-4);
    border: 2px dashed var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text-muted);
    text-align: center;
    cursor: pointer;
    transition: border-color var(--duration), background var(--duration);
  }
  .dropzone:hover,
  .dropzone.dragging {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .dropzone svg {
    color: var(--accent);
  }
  .dropzone.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .sample {
    margin-top: var(--space-3);
  }
  .label {
    color: var(--text);
    font-weight: 600;
    font-size: 1.1rem;
  }
</style>
