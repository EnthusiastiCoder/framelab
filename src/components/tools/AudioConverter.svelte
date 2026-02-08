<script lang="ts">
  // Audio converter: MP3 (96 to 320 kbps), M4A (AAC), WAV, Opus or FLAC. MP3 and FLAC use a bundled
  // WebAssembly encoder where the browser has none.
  import ToolRunner, { type Built, type InputInfo } from '../ToolRunner.svelte';
  import { AUDIO_FORMATS, audioBitrateFor, audioFormatOutput, type AudioFormat } from '../../lib/media-options';

  let format = $state<AudioFormat>('mp3');
  let kbps = $state('192');

  const lossy = $derived(format === 'mp3' || format === 'm4a' || format === 'ogg');

  function build(info: InputInfo): Built {
    const output = audioFormatOutput(format);
    const rate = Number(kbps) || 192;
    return {
      job: { op: 'audio-convert', output, forceTranscode: true, ...(lossy ? { audioBitrate: rate * 1000 } : {}) },
      planner: { op: 'audio-convert', output, transcode: true },
      estimate: (audioBitrateFor(format, rate) * info.duration) / 8,
    };
  }
</script>

<ToolRunner name="Audio converter tool" runLabel="Convert audio" accept="audio/*,video/*" dropLabel="Drop an audio file here" needs="audio" {build}>
  {#snippet options()}
    <div class="field-row">
      <label class="field">
        Format
        <select aria-label="Format" bind:value={format}>
          {#each AUDIO_FORMATS as f (f.value)}
            <option value={f.value}>{f.label}</option>
          {/each}
        </select>
      </label>
      {#if lossy}
        <label class="field">
          Bitrate (kbps)
          <select aria-label="Bitrate (kbps)" bind:value={kbps}>
            {#each ['96', '128', '160', '192', '256', '320'] as b (b)}
              <option value={b}>{b}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>
    <p class="hint">WAV and FLAC keep every detail; FLAC is about half the size of WAV. Higher bitrates sound better and make larger files.</p>
  {/snippet}
</ToolRunner>
