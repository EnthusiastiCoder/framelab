<script lang="ts">
  // Export: a download link for the result Blob, with its name and size. Revokes the object URL on change.
  import type { Result } from '../engine/types';

  interface Props {
    result: Result;
    notice?: string;
    onreset?: () => void;
  }

  let { result, notice = '', onreset }: Props = $props();

  let href = $state('');
  $effect(() => {
    const url = URL.createObjectURL(result.blob);
    href = url;
    return () => URL.revokeObjectURL(url);
  });

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }
</script>

<div class="export card" role="status" aria-live="polite">
  <p class="done">Done. Your file is ready.</p>
  {#if notice}<p class="notice">{notice}</p>{/if}
  <p class="meta"><span class="name">{result.filename}</span> <span class="muted">· {formatSize(result.size)}</span></p>
  <div class="actions">
    <a class="btn" data-testid="download" download={result.filename} {href}>Download</a>
    {#if onreset}<button type="button" class="btn btn-secondary" onclick={onreset}>Start over</button>{/if}
  </div>
</div>

<style>
  .export {
    border-color: var(--success);
  }
  .done {
    color: var(--success);
    font-weight: 700;
    margin-bottom: var(--space-2);
  }
  .notice {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--warning-soft);
    color: var(--warning);
  }
  .name {
    font-family: var(--font-mono);
    word-break: break-all;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
</style>
