<script lang="ts">
  // Audio cutter: pick a range on the waveform, add fades of up to 10 s, and save in the input's format
  // (MP3 when the input format cannot be written).
  import ToolRunner, { type Built, type InputInfo } from '../ToolRunner.svelte';
  import Waveform from '../Waveform.svelte';
  import type { EngineClient } from '../../engine/client';
  import { audioBitrateFor, audioFormatOf, audioFormatOutput, parseTime } from '../../lib/media-options';

  let start = $state('0');
  let end = $state('');
  let fadeIn = $state('0');
  let fadeOut = $state('0');
  let peaks = $state<Float32Array | null>(null);
  let duration = $state(0);
  let loads = 0;

  function onloaded(file: File, info: InputInfo, engine: EngineClient) {
    duration = info.duration;
    // Fill in the defaults only where the user has not typed anything yet.
    if (!String(start).trim()) start = '0';
    if (!String(end).trim()) end = String(Math.round(info.duration * 1000) / 1000);
    peaks = null;
    const mine = ++loads;
    engine
      .run({ op: 'peaks', count: 600 }, file)
      .then((r) => mine === loads && (peaks = r.peaks ?? null))
      .catch(() => mine === loads && (peaks = new Float32Array(600)));
  }

  function pick(edge: 'start' | 'end', t: number) {
    if (edge === 'start') start = String(t);
    else end = String(t);
  }

  function build(info: InputInfo, file: File): Built {
    const s = parseTime(start);
    const e = Math.min(parseTime(end) ?? info.duration, info.duration);
    const fi = Number(fadeIn || 0);
    const fo = Number(fadeOut || 0);
    if (s === null) return { error: 'Enter the start as seconds or mm:ss.' };
    if (!(e > s)) return { error: 'The end must be after the start.' };
    if (!(fi >= 0 && fi <= 10 && fo >= 0 && fo <= 10)) return { error: 'Fades can be from 0 to 10 seconds.' };
    const format = audioFormatOf(info) ?? 'mp3';
    const output = audioFormatOutput(format);
    const kbps = format === 'mp3' ? 192 : format === 'm4a' ? 160 : 128;
    return {
      job: {
        op: 'audio-cut',
        output,
        trim: { start: s, end: e },
        fade: { fadeIn: fi, fadeOut: fo },
        ...(format === 'wav' || format === 'flac' ? {} : { audioBitrate: kbps * 1000 }),
      },
      planner: { op: 'audio-cut', output, transcode: true },
      estimate: Math.max((audioBitrateFor(format, kbps) * (e - s)) / 8, file.size * ((e - s) / (info.duration || 1))),
    };
  }

  const startS = $derived(parseTime(start) ?? 0);
  const endS = $derived(parseTime(end) ?? duration);
</script>

<ToolRunner name="Audio cutter tool" runLabel="Cut audio" accept="audio/*" dropLabel="Drop an audio file here" needs="audio" {build} {onloaded}>
  {#snippet options()}
    {#if duration > 0}
      <Waveform {peaks} {duration} start={startS} end={endS} onpick={pick} />
    {/if}
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
        Fade in (s)
        <input type="number" min="0" max="10" step="0.1" bind:value={fadeIn} />
      </label>
      <label class="field">
        Fade out (s)
        <input type="number" min="0" max="10" step="0.1" bind:value={fadeOut} />
      </label>
    </div>
    <p class="hint">The cut is saved in the same format as your file, or as MP3 when that format cannot be written here.</p>
  {/snippet}
</ToolRunner>
