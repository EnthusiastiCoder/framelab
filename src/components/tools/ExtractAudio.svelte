<script lang="ts">
  // Extract audio: saves a video's soundtrack as MP3, M4A (AAC), WAV or Opus, dropping the picture.
  import ToolRunner, { type Built, type InputInfo } from '../ToolRunner.svelte';
  import { audioBitrateFor, audioFormatOutput, type AudioFormat } from '../../lib/media-options';

  interface Props {
    /** /video-to-mp3 preselects MP3. */
    format?: AudioFormat;
  }
  let { format: initial = 'mp3' }: Props = $props();

  // svelte-ignore state_referenced_locally
  let format = $state<AudioFormat>(initial);

  const KBPS: Record<AudioFormat, number> = { mp3: 192, m4a: 160, ogg: 128, wav: 0, flac: 0 };

  function build(info: InputInfo): Built {
    if (info.audioTracks === 0) return { error: 'This video has no sound to extract.' };
    const output = audioFormatOutput(format);
    const kbps = KBPS[format];
    return {
      job: { op: 'extract-audio', output, ...(kbps ? { audioBitrate: kbps * 1000 } : {}) },
      planner: { op: 'extract-audio', output },
      estimate: (audioBitrateFor(format, kbps) * info.duration) / 8,
    };
  }
</script>

<ToolRunner name="Extract audio tool" runLabel="Extract audio" needs="any" {build}>
  {#snippet options()}
    <label class="field">
      Format
      <select aria-label="Format" bind:value={format}>
        <option value="mp3">MP3</option>
        <option value="m4a">M4A</option>
        <option value="wav">WAV</option>
        <option value="ogg">Opus</option>
      </select>
    </label>
    <p class="hint">MP3 plays everywhere. M4A (AAC) suits Apple devices, WAV is uncompressed, and Opus is the smallest.</p>
  {/snippet}
</ToolRunner>
