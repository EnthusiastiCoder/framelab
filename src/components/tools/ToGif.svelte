<script lang="ts">
  // Video to GIF: pick a range, a frame rate and a width; a live estimate shows the GIF size before you run it.
  import ToolRunner, { type Built, type InputInfo } from '../ToolRunner.svelte';
  import { estimateGifBytes } from '../../engine/gif-math';
  import { parseTime } from '../../lib/media-options';

  let start = $state('0');
  let end = $state('');
  let fps = $state('10');
  let width = $state('480');
  let loaded = $state<InputInfo | null>(null);

  function onloaded(_file: File, info: InputInfo) {
    loaded = info;
    // Fill in the defaults only where the user has not typed anything yet.
    if (!String(start).trim()) start = '0';
    if (!String(end).trim()) end = String(Math.round(Math.min(info.duration, 5) * 100) / 100);
    if (info.width && info.width < Number(width)) width = String(info.width);
  }

  function settings(info: InputInfo) {
    const s = parseTime(start);
    const e = parseTime(end) ?? info.duration;
    const f = Number(fps);
    const w = Number(width);
    if (s === null) return { error: 'Enter the start as seconds or mm:ss.' };
    if (!(e > s)) return { error: 'The end must be after the start.' };
    if (!(f >= 1 && f <= 30)) return { error: 'Pick a frame rate from 1 to 30 fps.' };
    if (!(w >= 16 && w <= 1920)) return { error: 'Pick a width from 16 to 1920 px.' };
    const end2 = Math.min(e, info.duration || e);
    const height = info.width && info.height ? Math.round((info.height * w) / info.width) : Math.round((w * 9) / 16);
    return { start: s, end: end2, fps: f, width: w, height };
  }

  function build(info: InputInfo): Built {
    const v = settings(info);
    if ('error' in v) return { error: v.error as string };
    return {
      job: { op: 'gif', start: v.start, end: v.end, fps: v.fps, width: v.width },
      planner: { op: 'gif', output: { container: 'gif' } },
      estimate: estimateGifBytes({ width: v.width, height: v.height, fps: v.fps, durationSec: v.end - v.start }),
    };
  }

  const estimate = $derived.by(() => {
    if (!loaded) return '';
    const v = settings(loaded);
    if ('error' in v) return '';
    const bytes = estimateGifBytes({ width: v.width, height: v.height, fps: v.fps, durationSec: v.end - v.start });
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  });
</script>

<ToolRunner name="Video to GIF tool" runLabel="Make GIF" {build} {onloaded}>
  {#snippet options()}
    <div class="field-row">
      <label class="field">
        Start
        <input type="text" inputmode="decimal" bind:value={start} />
      </label>
      <label class="field">
        End
        <input type="text" inputmode="decimal" bind:value={end} />
      </label>
    </div>
    <div class="field-row">
      <label class="field">
        Frame rate (fps)
        <input type="number" min="1" max="30" step="1" bind:value={fps} />
      </label>
      <label class="field">
        Width (px)
        <input type="number" min="16" max="1920" step="2" bind:value={width} />
      </label>
    </div>
    <p class="hint" aria-live="polite">{estimate ? `Estimated size: about ${estimate}.` : 'Short clips at 10 fps and 480 px make small, smooth GIFs.'}</p>
  {/snippet}
</ToolRunner>
