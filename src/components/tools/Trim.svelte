<script lang="ts">
  // Trim video: Exact re-encodes so the cut lands on the frame; Fast copies the streams and starts at a keyframe.
  import ToolRunner, { type Built, type InputInfo } from '../ToolRunner.svelte';
  import { parseTime, sameFamilyVideo } from '../../lib/media-options';
  import { format as fmt } from '../../engine/timecode';

  let mode = $state<'exact' | 'fast'>('exact');
  let start = $state('0');
  let end = $state('');

  function onloaded(_file: File, info: InputInfo) {
    // Fill in the defaults only where the user has not typed anything yet.
    if (!start.trim()) start = '0';
    if (!end.trim()) end = fmt(info.duration).replace(/^00:/, '');
  }

  function build(info: InputInfo, file: File): Built {
    const s = parseTime(start);
    const e = parseTime(end) ?? info.duration;
    if (s === null) return { error: 'Enter the start as seconds or mm:ss.' };
    if (e <= s) return { error: 'The end must be after the start.' };
    const output = sameFamilyVideo(info);
    const exact = mode === 'exact';
    const length = Math.min(e, info.duration) - s;
    return {
      job: { op: 'trim', output, trim: { start: s, end: Math.min(e, info.duration) }, copyOnly: !exact },
      planner: { op: 'trim', output, transcode: exact },
      estimate: info.duration > 0 ? (file.size * Math.max(0, length)) / info.duration * (exact ? 1.5 : 1) : file.size,
    };
  }
</script>

<ToolRunner name="Trim video tool" runLabel="Trim video" {build} {onloaded}>
  {#snippet options()}
    <div class="field-row">
      <label class="field">
        Start
        <input type="text" inputmode="decimal" placeholder="0" bind:value={start} />
      </label>
      <label class="field">
        End
        <input type="text" inputmode="decimal" placeholder="end of the video" bind:value={end} />
      </label>
    </div>
    <fieldset class="choices">
      <legend>Mode</legend>
      <label><input type="radio" name="trim-mode" value="exact" bind:group={mode} /> Exact</label>
      <label><input type="radio" name="trim-mode" value="fast" bind:group={mode} /> Fast, no quality loss</label>
    </fieldset>
    {#if mode === 'fast'}
      <p class="hint" data-testid="keyframe-note">
        Fast mode copies the video without re-encoding, so it starts at the nearest keyframe before your start time. The
        clip may begin up to a second early.
      </p>
    {:else}
      <p class="hint">Exact mode re-encodes the clip so it starts and ends on the frames you chose. Times accept seconds or mm:ss.</p>
    {/if}
  {/snippet}
</ToolRunner>
