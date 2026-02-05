<script lang="ts">
  // Convert video: MP4 (H.264/AAC) or WebM (VP9/Opus). Matching streams are copied, the rest re-encoded.
  import ToolRunner, { type Built, type InputInfo } from '../ToolRunner.svelte';
  import { videoFormatOutput, type VideoFormat } from '../../lib/media-options';

  interface Props {
    /** Variant pages (/mov-to-mp4, /mp4-to-webm, ...) preselect the output format. */
    format?: VideoFormat;
  }
  let { format: initial = 'mp4' }: Props = $props();

  // svelte-ignore state_referenced_locally
  let format = $state<VideoFormat>(initial);

  function build(info: InputInfo, file: File): Built {
    const output = videoFormatOutput(format, info);
    return {
      job: { op: 'convert', output },
      planner: { op: 'convert', output },
      estimate: Math.max(file.size * 1.5, (2_500_000 * info.duration) / 8),
    };
  }
</script>

<ToolRunner name="Convert video tool" runLabel="Convert video" {build}>
  {#snippet options()}
    <label class="field">
      Output format
      <select aria-label="Output format" bind:value={format}>
        <option value="mp4">MP4</option>
        <option value="webm">WebM</option>
      </select>
    </label>
    <p class="hint">MP4 (H.264 and AAC) plays everywhere. WebM (VP9 and Opus) is smaller and open.</p>
  {/snippet}
</ToolRunner>
