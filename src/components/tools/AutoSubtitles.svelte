<script lang="ts">
  // Auto-subtitles: Whisper runs in this browser (a separate worker), the cues open in the editor, then export as
  // SRT/VTT or burn into the video. The model is only downloaded after the size notice is accepted (decision 3).
  import { onMount } from 'svelte';
  import DropZone from '../DropZone.svelte';
  import ProgressPanel from '../ProgressPanel.svelte';
  import ExportPanel from '../ExportPanel.svelte';
  import ErrorCard from '../ErrorCard.svelte';
  import NetworkProof from '../NetworkProof.svelte';
  import SubtitleEditor from '../SubtitleEditor.svelte';
  import ModelConsentDialog from '../ModelConsentDialog.svelte';
  import CaptionStylePanel from '../CaptionStylePanel.svelte';
  import { EngineClient } from '../../engine/client';
  import { detectCapabilities, WASM_ENCODERS, type Capabilities } from '../../engine/capabilities';
  import { planPath } from '../../engine/planner';
  import { EngineError, toErrorCode, type EngineErrorCode, type InputInfo, type Job, type Progress, type Result } from '../../engine/types';
  import { sameFamilyVideo } from '../../lib/media-options';
  import { AsrClient } from '../../subtitles/asr-client';
  import type { AsrPhase } from '../../subtitles/asr-protocol';
  import { createDownloadGate, type DownloadGate } from '../../subtitles/download-gate';
  import { isModelCached } from '../../subtitles/model-cache';
  import { DEFAULT_MODEL_ID, MODELS, findModel } from '../../subtitles/models';
  import { segmentChunks } from '../../subtitles/segment';
  import { saveSubtitles } from '../../subtitles/files';
  import { DEFAULT_STYLE, type CaptionStyle } from '../../subtitles/style';
  import type { Cue } from '../../subtitles/cue';

  type Status = 'empty' | 'probing' | 'ready' | 'transcribing' | 'editing' | 'burning' | 'done';

  let status = $state<Status>('empty');
  let file = $state<File | null>(null);
  let info = $state<InputInfo | null>(null);
  let modelId = $state(DEFAULT_MODEL_ID);
  let needsDownload = $state(false);
  let notice = $state<{ cached: boolean } | null>(null);
  let progress = $state<Progress | null>(null);
  let progressLabel = $state('');
  let cues = $state<Cue[]>([]);
  let style = $state<CaptionStyle>({ ...DEFAULT_STYLE });
  let result = $state<Result | null>(null);
  let resultNotice = $state('');
  let error = $state<{ code: EngineErrorCode; message: string } | null>(null);

  let mock = false;
  let gate: DownloadGate = createDownloadGate(null);
  let caps: Capabilities | null = null;
  let engine: EngineClient | null = null;
  let asr: AsrClient | null = null;
  let controller: AbortController | null = null;

  const model = $derived(findModel(modelId));
  const canBurn = $derived(!!info && info.videoTracks > 0 && cues.length > 0);

  onMount(() => {
    const q = new URLSearchParams(location.search);
    mock = q.get('asr') === 'mock';
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    gate = createDownloadGate(storage);
    detectCapabilities(window).then((c) => (caps = c));
    return () => {
      controller?.abort();
      engine?.dispose();
      asr?.dispose();
    };
  });

  function showError(err: unknown) {
    const code = err instanceof EngineError ? err.code : toErrorCode(err);
    error = { code, message: err instanceof Error ? err.message : String(err) };
  }

  async function onfiles(files: File[]) {
    if (status === 'transcribing' || status === 'burning') return;
    const f = files[0];
    if (!f) return;
    file = f;
    info = null;
    cues = [];
    result = null;
    error = null;
    needsDownload = false;
    notice = null;
    status = 'probing';
    try {
      engine ??= new EngineClient();
      const probed = await engine.probe(f);
      if (file !== f) return;
      if (probed.audioTracks === 0) throw new EngineError('UNSUPPORTED_INPUT', 'This file has no audio track, so there is no speech to transcribe.');
      info = probed;
      status = 'ready';
    } catch (err) {
      if (file !== f) return;
      file = null;
      status = 'empty';
      showError(err);
    }
  }

  async function generate() {
    if (!file || status !== 'ready') return;
    error = null;
    if (mock) return transcribe();
    if ((await isModelCached(model)) || gate.allowed()) return transcribe();
    needsDownload = true;
  }

  async function openNotice() {
    notice = { cached: await isModelCached(model) };
  }

  function accept(remember: boolean) {
    gate.confirm(remember);
    notice = null;
    needsDownload = false;
    void transcribe();
  }

  function decline() {
    notice = null;
  }

  const PHASE_LABEL: Record<AsrPhase, string> = {
    download: 'Downloading the speech model',
    decode: 'Reading the audio',
    transcribe: 'Transcribing speech',
  };

  async function transcribe() {
    if (!file) return;
    const f = file;
    controller = new AbortController();
    status = 'transcribing';
    progress = { phase: 'processing', ratio: 0 };
    progressLabel = mock ? PHASE_LABEL.transcribe : 'Preparing the speech model';
    try {
      asr ??= new AsrClient();
      const chunks = await asr.transcribe(f, {
        modelId,
        mock,
        signal: controller.signal,
        onProgress: (phase, ratio) => {
          progressLabel = PHASE_LABEL[phase];
          progress = { phase: 'processing', ratio };
        },
      });
      if (file !== f) return;
      cues = segmentChunks(chunks);
      status = 'editing';
    } catch (err) {
      status = 'ready';
      if ((err as { name?: string })?.name !== 'AbortError') showError(err);
    } finally {
      controller = null;
      progress = null;
    }
  }

  function cancel() {
    controller?.abort();
    controller = null;
    progress = null;
    status = cues.length && status === 'burning' ? 'editing' : 'ready';
  }

  async function burn() {
    if (!file || !info || !canBurn) return;
    error = null;
    caps ??= await detectCapabilities(window);
    const output = sameFamilyVideo(info);
    const plan = planPath({ op: 'burn', output, transcode: true }, { ...caps, wasmEncoders: WASM_ENCODERS }, info);
    if (plan.path === 'unsupported' || !plan.output) {
      showError(new EngineError('UNSUPPORTED_BROWSER', plan.reason));
      return;
    }
    const job: Job = { op: 'burn', output: plan.output, cues: $state.snapshot(cues), style: $state.snapshot(style) };
    controller = new AbortController();
    status = 'burning';
    progressLabel = 'Burning in the subtitles';
    progress = { phase: 'reading', ratio: 0 };
    try {
      engine ??= new EngineClient();
      const r = await engine.run(job, file, { signal: controller.signal, onProgress: (p) => (progress = p) });
      result = r;
      resultNotice = plan.fallback ? plan.reason : '';
      status = 'done';
    } catch (err) {
      status = 'editing';
      if (!(err instanceof EngineError && err.code === 'CANCELLED')) showError(err);
    } finally {
      controller = null;
      progress = null;
    }
  }

  function backToEditor() {
    result = null;
    status = 'editing';
  }
</script>

<section class="tool" aria-label="Auto subtitles tool">
  {#if status !== 'transcribing' && status !== 'burning'}
    <DropZone accept="video/*,audio/*" label="Drop a video or audio file here" hint="or press Enter to choose a file" {onfiles} />
  {/if}

  {#if error}
    <ErrorCard code={error.code} message={error.message} ondismiss={() => (error = null)} />
  {/if}

  {#if file && info}
    <div class="card file">
      <p class="name">{file.name}</p>
      <p class="muted small">Speech recognition runs on this device. Your audio is never uploaded.</p>
    </div>
  {/if}

  {#if status === 'empty' || status === 'probing' || status === 'ready'}
    <div class="options card">
      <label class="field">
        Model
        <select id="model-select" data-testid="model-select" bind:value={modelId}>
          {#each MODELS as m (m.id)}
            <option value={m.id}>{m.label}</option>
          {/each}
        </select>
      </label>
      <p class="hint">Smaller models are faster; larger ones make fewer mistakes. A model downloads once, then stays in this browser.</p>
    </div>
    <button type="button" class="btn run" data-testid="run" disabled={status !== 'ready'} onclick={generate}>Generate subtitles</button>
  {/if}

  {#if status === 'probing'}
    <p class="muted" role="status">Reading the file…</p>
  {/if}

  {#if needsDownload && status === 'ready' && !notice}
    <div class="card need">
      <p>This speech model is not in your browser yet.</p>
      <button type="button" class="btn" onclick={openNotice}>Download model</button>
    </div>
  {/if}

  {#if notice}
    <ModelConsentDialog {model} cached={notice.cached} ondownload={accept} oncancel={decline} />
  {/if}

  {#if status === 'transcribing' || status === 'burning'}
    <ProgressPanel {progress} label={progressLabel} oncancel={cancel} />
  {/if}

  {#if status === 'editing'}
    <SubtitleEditor bind:cues />
    <div class="card exports">
      <div class="row">
        <button type="button" class="btn btn-secondary" data-testid="download-srt" onclick={() => file && saveSubtitles($state.snapshot(cues), file.name, 'srt')}>Download SRT</button>
        <button type="button" class="btn btn-secondary" data-testid="download-vtt" onclick={() => file && saveSubtitles($state.snapshot(cues), file.name, 'vtt')}>Download VTT</button>
      </div>
      {#if info && info.videoTracks > 0}
        <CaptionStylePanel bind:style />
        <button type="button" class="btn burn" data-testid="burn" disabled={!canBurn} onclick={burn}>Burn subtitles into the video</button>
      {/if}
    </div>
  {/if}

  {#if status === 'done' && result}
    <ExportPanel {result} notice={resultNotice} onreset={backToEditor} />
  {/if}

  <NetworkProof />
</section>

<style>
  .tool {
    display: grid;
    gap: var(--space-4);
  }
  .name {
    font-weight: 600;
    margin: 0;
    word-break: break-all;
  }
  .small {
    font-size: 0.9rem;
    margin: 0;
  }
  .options,
  .exports {
    display: grid;
    gap: var(--space-3);
  }
  .options .hint {
    margin: 0;
  }
  .need {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
  }
  .need p {
    margin: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .run,
  .burn {
    justify-self: start;
  }
</style>
