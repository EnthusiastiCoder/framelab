<script lang="ts">
  // Export: a download link for the result Blob, with its name, a before/after summary, "Process another" and
  // "Use the result in another tool" (local hand-off through IndexedDB, nothing is uploaded).
  import type { Result } from '../engine/types';
  import { tools } from '../lib/tools';
  import { sendTo } from '../lib/handoff';

  interface Props {
    result: Result;
    notice?: string;
    /** The input's size (bytes) and duration (seconds), for the before/after summary. */
    input?: { size: number; duration: number };
    /** The output's duration in seconds, when it could be read. */
    outputDuration?: number;
    onreset?: () => void;
    /** Label of the reset button. */
    resetLabel?: string;
  }

  let { result, notice = '', input, outputDuration, onreset, resetLabel = 'Process another' }: Props = $props();

  let showTools = $state(false);
  const here = typeof location === 'undefined' ? '' : location.pathname.replace(/^\/|\/$/g, '');
  const kind = $derived(result.mimeType.startsWith('video/') ? 'video' : result.mimeType.startsWith('audio/') ? 'audio' : '');
  const targets = $derived(
    kind === ''
      ? []
      : tools.filter((t) => t.slug !== here && !t.preset && (kind === 'video' ? t.accepts.includes('video') : t.accepts.includes('audio'))),
  );

  function send(e: MouseEvent, slug: string) {
    e.preventDefault();
    void sendTo(slug, result.blob, result.filename, result.mimeType);
  }

  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const r = Math.round(s - m * 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  const change = $derived(input && input.size > 0 ? Math.round(((result.size - input.size) / input.size) * 100) : null);

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
  {#if input}
    <p class="summary" data-testid="export-summary">
      Size: {formatSize(input.size)} → {formatSize(result.size)}{#if change !== null}&nbsp;({change > 0 ? '+' : change < 0 ? '−' : ''}{Math.abs(change)}%){/if}
      {#if input.duration > 0}· Length: {formatTime(input.duration)}{#if outputDuration !== undefined}&nbsp;→ {formatTime(outputDuration)}{/if}{/if}
    </p>
  {/if}
  <div class="actions">
    <a class="btn" data-testid="download" download={result.filename} {href}>Download</a>
    {#if onreset}<button type="button" class="btn btn-secondary" onclick={onreset}>{resetLabel}</button>{/if}
    {#if targets.length > 0}
      <button type="button" class="btn btn-secondary" aria-expanded={showTools} aria-controls="handoff-tools" onclick={() => (showTools = !showTools)}>
        Use the result in another tool
      </button>
    {/if}
  </div>
  {#if showTools}
    <ul class="handoff" id="handoff-tools">
      {#each targets as t (t.slug)}
        <li><a href={`/${t.slug}?handoff=1`} onclick={(e) => send(e, t.slug)}>{t.title}</a></li>
      {/each}
    </ul>
    <p class="hint">The file is passed on inside this browser. Nothing is uploaded.</p>
  {/if}
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
  .summary {
    font-size: 0.95rem;
  }
  .handoff {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    margin: var(--space-4) 0 var(--space-2);
    padding: 0;
    list-style: none;
  }
  .handoff a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
</style>
