<script lang="ts">
  // Compress video: a quality preset (bits per pixel for the resolution) or a target file size.
  import ToolRunner, { type Built, type InputInfo } from '../ToolRunner.svelte';
  import { belowH264Floor, presetBitrate, PRESET_AUDIO, videoBitrateForTarget, type Preset } from '../../engine/compress';
  import { inputBitrate, sameFamilyVideo } from '../../lib/media-options';

  let preset = $state<Preset>('balanced');
  let target = $state('');

  /** A preset never makes the video bigger: it is capped at a share of the input's own bitrate. */
  const CAP: Record<Preset, number> = { small: 0.45, balanced: 0.7, high: 0.9 };

  function build(info: InputInfo, file: File): Built {
    const output = sameFamilyVideo(info);
    const hasAudio = !!output.audioCodec;
    const duration = info.duration;
    const targetMB = Number(target);
    let videoBitrate: number;
    let audioBitrate = hasAudio ? PRESET_AUDIO[preset] : 0;
    if (target.trim() !== '') {
      if (!(targetMB > 0)) return { error: 'Enter a target size above 0 MB.' };
      audioBitrate = hasAudio ? (targetMB * 8e6) / duration < 600_000 ? 96_000 : 128_000 : 0;
      try {
        videoBitrate = videoBitrateForTarget({ targetMB, durationSec: duration, audioBitrate });
      } catch (err) {
        return { error: (err as Error).message };
      }
    } else {
      const fromPreset = presetBitrate(preset, info.height ?? 720, info.frameRate ?? 30);
      const cap = inputBitrate(file.size, duration) * CAP[preset] - audioBitrate;
      videoBitrate = Math.round(Math.max(100_000, Math.min(fromPreset, cap > 0 ? cap : fromPreset)));
    }
    let note: string | undefined;
    if (output.videoCodec === 'avc' && belowH264Floor(videoBitrate, info.width ?? 1280, info.height ?? 720, info.frameRate ?? 30)) {
      // Browser H.264 encoders ignore bitrates this low; VP9 (still in an MP4 file) keeps to the plan.
      output.videoCodec = 'vp9';
      note = 'This video is already small, so it is compressed with VP9 (in an MP4 file) to get it smaller still. It plays in every modern browser.';
    }
    return {
      note,
      job: { op: 'compress', output, videoBitrate, audioBitrate: audioBitrate || undefined, forceTranscode: true, constantBitrate: target.trim() !== '' && output.videoCodec === 'avc' },
      planner: { op: 'compress', output, transcode: true },
      estimate: ((videoBitrate + audioBitrate) * duration) / 8,
    };
  }

  function choose(p: Preset) {
    preset = p;
    target = '';
  }
</script>

<ToolRunner name="Compress video tool" runLabel="Compress video" {build} onlowerquality={() => choose('small')}>
  {#snippet options()}
    <fieldset class="choices">
      <legend>Quality</legend>
      <label><input type="radio" name="preset" value="small" checked={preset === 'small' && !target} onchange={() => choose('small')} /> Small</label>
      <label><input type="radio" name="preset" value="balanced" checked={preset === 'balanced' && !target} onchange={() => choose('balanced')} /> Balanced</label>
      <label><input type="radio" name="preset" value="high" checked={preset === 'high' && !target} onchange={() => choose('high')} /> High quality</label>
    </fieldset>
    <label class="field">
      Target size (MB)
      <input type="text" inputmode="decimal" placeholder="Optional" bind:value={target} />
    </label>
    <p class="hint">Leave the target empty to use the quality preset. The resolution stays the same.</p>
  {/snippet}
</ToolRunner>
