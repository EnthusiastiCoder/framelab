<script lang="ts">
  // Subtitle editor: one row per cue with its text, start/end nudges, split at the cursor, merge with next and
  // delete. Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) undo and redo at page level, outside text fields.
  import { onMount } from 'svelte';
  import type { Cue } from '../subtitles/cue';
  import { History, NUDGE, displayTime, mergeNext, nudge, remove, setText, split } from '../subtitles/edit';

  interface Props {
    cues: Cue[];
  }

  let { cues = $bindable() }: Props = $props();

  const history = new History();
  let areas: HTMLTextAreaElement[] = $state([]);
  let canUndo = $state(false);
  let canRedo = $state(false);
  /** The list before the current run of typing, recorded once the first keystroke lands. */
  let typingFrom: Cue[] | null = null;

  function sync() {
    canUndo = history.canUndo;
    canRedo = history.canRedo;
  }

  function apply(next: Cue[]) {
    if (next === cues) return;
    typingFrom = null;
    history.record(cues);
    cues = next;
    sync();
  }

  function undo() {
    const prev = history.undo(cues);
    if (prev) cues = prev;
    typingFrom = null;
    sync();
  }

  function redo() {
    const next = history.redo(cues);
    if (next) cues = next;
    typingFrom = null;
    sync();
  }

  function onfocus() {
    typingFrom = cues;
  }

  function oninput(i: number, value: string) {
    if (typingFrom) {
      history.record(typingFrom);
      typingFrom = null;
      sync();
    }
    cues = setText(cues, i, value);
  }

  function splitAt(i: number) {
    const area = areas[i];
    apply(split(cues, i, area ? area.selectionStart : 0));
  }

  onMount(() => {
    const onkey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onkey);
    return () => window.removeEventListener('keydown', onkey);
  });
</script>

<section class="editor card" data-testid="subtitle-editor" aria-label="Subtitle editor">
  <div class="head">
    <h2 class="title">Subtitles <span class="muted count">({cues.length} cues)</span></h2>
    <div class="history">
      <button type="button" class="btn btn-secondary" onclick={undo} disabled={!canUndo} aria-keyshortcuts="Control+Z">Undo</button>
      <button type="button" class="btn btn-secondary" onclick={redo} disabled={!canRedo} aria-keyshortcuts="Control+Shift+Z">Redo</button>
    </div>
  </div>
  {#if cues.length === 0}
    <p class="muted">No speech was found. You can still add subtitles with the burn-in tool from an SRT file.</p>
  {/if}
  <ol class="cues">
    {#each cues as cue, i (i)}
      <li class="cue" data-testid="cue" aria-label={`Cue ${i + 1}`}>
        <div class="times">
          <span class="time" aria-label={`Starts at ${displayTime(cue.start)}`}>{displayTime(cue.start)}</span>
          <span aria-hidden="true">→</span>
          <span class="time" aria-label={`Ends at ${displayTime(cue.end)}`}>{displayTime(cue.end)}</span>
        </div>
        <label class="visually-hidden" for={`cue-text-${i}`}>Cue text</label>
        <textarea
          id={`cue-text-${i}`}
          rows="2"
          value={cue.text}
          bind:this={areas[i]}
          onfocus={onfocus}
          oninput={(e) => oninput(i, e.currentTarget.value)}
        ></textarea>
        <div class="actions">
          <button type="button" class="btn btn-secondary sm" onclick={() => apply(nudge(cues, i, 'start', -NUDGE))}>Start -0.1 s</button>
          <button type="button" class="btn btn-secondary sm" onclick={() => apply(nudge(cues, i, 'start', NUDGE))}>Start +0.1 s</button>
          <button type="button" class="btn btn-secondary sm" onclick={() => apply(nudge(cues, i, 'end', -NUDGE))}>End -0.1 s</button>
          <button type="button" class="btn btn-secondary sm" onclick={() => apply(nudge(cues, i, 'end', NUDGE))}>End +0.1 s</button>
          <button type="button" class="btn btn-secondary sm" onclick={() => splitAt(i)}>Split</button>
          <button type="button" class="btn btn-secondary sm" disabled={i === cues.length - 1} onclick={() => apply(mergeNext(cues, i))}>Merge with next</button>
          <button type="button" class="btn btn-secondary sm danger" onclick={() => apply(remove(cues, i))}>Delete</button>
        </div>
      </li>
    {/each}
  </ol>
</section>

<style>
  .editor {
    display: grid;
    gap: var(--space-3);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .title {
    margin: 0;
    font-size: 1.15rem;
  }
  .count {
    font-weight: 400;
    font-size: 0.95rem;
  }
  .history {
    display: flex;
    gap: var(--space-2);
  }
  .cues {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
    max-height: 32rem;
    overflow: auto;
  }
  .cue {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
  }
  .times {
    display: flex;
    gap: var(--space-2);
    font-family: var(--font-mono);
    font-size: 0.9rem;
    color: var(--text-muted);
  }
  textarea {
    width: 100%;
    font: inherit;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    resize: vertical;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .sm {
    padding: var(--space-1) var(--space-2);
    font-size: 0.85rem;
  }
  .danger {
    color: var(--danger);
  }
</style>
