<script lang="ts">
  // Cut video: remove one or more sections; the rest is joined frame-exactly with the audio kept in sync.
  import ToolRunner, { type Built, type InputInfo } from '../ToolRunner.svelte';
  import { keepRanges, rangesDuration, type Range } from '../../engine/ranges';
  import { parseTime, sameFamilyVideo } from '../../lib/media-options';

  let sections = $state<Array<{ id: number; from: string; to: string }>>([]);
  let nextId = 1;

  function add() {
    sections.push({ id: nextId++, from: '', to: '' });
  }

  function remove(id: number) {
    sections = sections.filter((s) => s.id !== id);
  }

  function build(info: InputInfo, file: File): Built {
    const removals: Range[] = [];
    for (const s of sections) {
      const a = parseTime(s.from);
      const b = parseTime(s.to);
      if (a === null && b === null) continue;
      if (a === null || b === null) return { error: 'Enter both a start and an end for every section.' };
      removals.push([a, b]);
    }
    if (removals.length === 0) return { error: 'Add a section to remove.' };
    const keep = keepRanges(info.duration, removals);
    const left = rangesDuration(keep);
    if (left <= 0) return { error: 'Nothing would be left after these cuts.' };
    const output = sameFamilyVideo(info);
    return {
      job: { op: 'cut', output, keep },
      planner: { op: 'cut', output, transcode: true },
      estimate: info.duration > 0 ? ((file.size * left) / info.duration) * 1.5 : file.size,
    };
  }
</script>

<ToolRunner name="Cut video tool" runLabel="Cut video" {build}>
  {#snippet options()}
    <p class="hint">Add each part you want to remove. Times accept seconds or mm:ss.</p>
    {#each sections as section, i (section.id)}
      <div class="field-row">
        <label class="field">
          Remove from
          <input type="text" inputmode="decimal" placeholder="0" bind:value={section.from} />
        </label>
        <label class="field">
          Remove to
          <input type="text" inputmode="decimal" placeholder="0" bind:value={section.to} />
        </label>
        <button type="button" class="btn btn-secondary" aria-label={`Delete section ${i + 1}`} onclick={() => remove(section.id)}>Delete</button>
      </div>
    {/each}
    <button type="button" class="btn btn-secondary add" onclick={add}>Add section</button>
  {/snippet}
</ToolRunner>

<style>
  .add {
    justify-self: start;
  }
</style>
