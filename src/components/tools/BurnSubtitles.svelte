<script lang="ts">
  // Burn subtitles: draw the cues of an SRT or WebVTT file onto every frame of a video.
  import ToolRunner, { type Built, type InputInfo } from '../ToolRunner.svelte';
  import CaptionStylePanel from '../CaptionStylePanel.svelte';
  import { sameFamilyVideo } from '../../lib/media-options';
  import { parseSubtitles } from '../../subtitles/files';
  import { DEFAULT_STYLE, type CaptionStyle } from '../../subtitles/style';
  import type { Cue } from '../../subtitles/cue';

  let cues = $state<Cue[]>([]);
  let subtitleName = $state('');
  let subtitleError = $state('');
  let style = $state<CaptionStyle>({ ...DEFAULT_STYLE });

  async function onsubtitle(e: Event & { currentTarget: HTMLInputElement }) {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    subtitleError = '';
    try {
      const parsed = parseSubtitles(await f.text());
      if (parsed.length === 0) throw new Error('No subtitles were found in this file.');
      cues = parsed;
      subtitleName = f.name;
    } catch (err) {
      cues = [];
      subtitleName = '';
      subtitleError = err instanceof Error ? err.message : String(err);
    }
  }

  function build(info: InputInfo, file: File): Built {
    if (cues.length === 0) return { error: 'Choose a subtitle file (SRT or VTT) to burn in.' };
    const output = sameFamilyVideo(info);
    return {
      job: { op: 'burn', output, cues: $state.snapshot(cues), style: $state.snapshot(style) },
      planner: { op: 'burn', output, transcode: true },
      estimate: file.size * 1.5,
      note: `${cues.length} subtitle${cues.length === 1 ? '' : 's'} from ${subtitleName} will be drawn onto the video.`,
    };
  }
</script>

<ToolRunner name="Burn subtitles tool" runLabel="Burn subtitles" {build}>
  {#snippet options()}
    <label class="field">
      Subtitle file (SRT or VTT)
      <input type="file" accept=".srt,.vtt,application/x-subrip,text/vtt" data-testid="subtitle-file" onchange={onsubtitle} />
    </label>
    {#if subtitleName}
      <p class="hint" role="status">{cues.length} subtitle{cues.length === 1 ? '' : 's'} loaded from {subtitleName}.</p>
    {/if}
    {#if subtitleError}
      <p class="hint error" role="alert">{subtitleError}</p>
    {/if}
    <CaptionStylePanel bind:style />
  {/snippet}
</ToolRunner>

<style>
  .error {
    color: var(--danger);
  }
</style>
