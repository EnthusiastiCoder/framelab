<script lang="ts" module>
  import type { Job, InputInfo } from '../engine/types';
  import type { PlannerJob } from '../engine/planner';

  /** What a tool island hands the runner for the loaded file: the job to plan and run, and a size estimate. */
  export type Built =
    | {
        /** The job; its `output` is replaced by the planned output before it runs. */
        job: Job;
        /** What the planner sees (op, requested output, whether the streams change). */
        planner: PlannerJob;
        /** Estimated output size in bytes (memory policy). */
        estimate: number;
        /** A plain-language note about the chosen settings, shown with the file details. */
        note?: string;
        error?: undefined;
      }
    | { error: string };

  export type Needs = 'video' | 'audio' | 'any';
  export type { InputInfo };
</script>

<script lang="ts">
  // Shared tool shell: capability check, drop, probe, engine plan (chip and reason), memory warning, run, cancel,
  // progress, export and errors. Each tool island supplies its options and a build(info) callback.
  import { onMount, type Snippet } from 'svelte';
  import DropZone from './DropZone.svelte';
  import ProgressPanel from './ProgressPanel.svelte';
  import ExportPanel from './ExportPanel.svelte';
  import ErrorCard from './ErrorCard.svelte';
  import CapabilityBanner from './CapabilityBanner.svelte';
  import NetworkProof from './NetworkProof.svelte';
  import UnsupportedBrowser from './UnsupportedBrowser.svelte';
  import { detectCapabilities, missingFeatures, WASM_ENCODERS, type Capabilities } from '../engine/capabilities';
  import { planPath, type Plan } from '../engine/planner';
  import { assessMemory } from '../engine/memory';
  import { EngineClient } from '../engine/client';
  import { EngineError, toErrorCode, type EngineErrorCode, type Progress, type Result } from '../engine/types';

  interface Props {
    /** Accessible name of the tool section, e.g. "Compress video tool". */
    name: string;
    runLabel: string;
    accept?: string;
    dropLabel?: string;
    needs?: Needs;
    build: (info: InputInfo, file: File) => Built;
    /** Called once a file is probed (e.g. to set a default range or load a waveform). */
    onloaded?: (file: File, info: InputInfo, engine: EngineClient) => void;
    /** Lowers the quality options; offered on the memory warning. */
    onlowerquality?: () => void;
    options?: Snippet;
  }

  let {
    name,
    runLabel,
    accept = 'video/*',
    dropLabel = 'Drop a video here',
    needs = 'video',
    build,
    onloaded,
    onlowerquality,
    options,
  }: Props = $props();

  type Status = 'checking' | 'unsupported' | 'empty' | 'probing' | 'ready' | 'confirm' | 'running' | 'done';

  let status = $state<Status>('checking');
  let caps = $state<Capabilities | null>(null);
  let missing = $state<string[]>([]);
  let unsupportedReason = $state('');
  let file = $state<File | null>(null);
  let info = $state<InputInfo | null>(null);
  let progress = $state<Progress | null>(null);
  let result = $state<Result | null>(null);
  let notice = $state('');
  let memoryMessage = $state('');
  let error = $state<{ code: EngineErrorCode; message: string } | null>(null);

  let client: EngineClient | null = null;
  let controller: AbortController | null = null;
  let runToken = 0;
  let slowMs = 0;
  let memtest = false;

  const built = $derived<Built | null>(info && file ? build(info, file) : null);
  const plan = $derived<Plan | null>(
    caps && info && built && !built.error ? planPath(built.planner, { ...caps, wasmEncoders: WASM_ENCODERS }, info) : null,
  );
  const chip = $derived(plan?.path === 'wasm' ? 'Engine: Compatibility (WASM encoder)' : 'Engine: Fast (WebCodecs)');
  const showReason = $derived(!!plan && (plan.fallback || plan.path === 'wasm' || plan.path === 'unsupported'));
  const canRun = $derived(status === 'ready' && !!plan && plan.path !== 'unsupported' && !!built && !built.error);

  onMount(() => {
    const q = new URLSearchParams(location.search);
    slowMs = q.get('slow') === '1' ? 3000 : 0;
    memtest = q.has('memtest');
    let alive = true;
    detectCapabilities(window).then((c) => {
      if (!alive) return;
      caps = c;
      missing = missingFeatures(c);
      const p = planPath({ op: 'probe' }, c, {});
      if (p.path === 'unsupported') {
        unsupportedReason = p.reason;
        status = 'unsupported';
      } else {
        status = file ? status : 'empty';
      }
    });
    return () => {
      alive = false;
      controller?.abort();
      client?.dispose();
    };
  });

  function engine(): EngineClient {
    client ??= new EngineClient();
    return client;
  }

  function showError(err: unknown) {
    const code = err instanceof EngineError ? err.code : toErrorCode(err);
    error = { code, message: err instanceof Error ? err.message : String(err) };
  }

  async function onfiles(files: File[]) {
    if (status === 'unsupported' || status === 'running') return;
    const f = files[0];
    if (!f) return;
    file = f;
    info = null;
    result = null;
    error = null;
    status = 'probing';
    try {
      const probed = await engine().probe(f);
      if (file !== f) return;
      if (needs === 'video' && probed.videoTracks === 0) {
        throw new EngineError('UNSUPPORTED_INPUT', 'This file has no video track. To change audio, use an audio tool.');
      }
      if (needs === 'audio' && probed.audioTracks === 0) {
        throw new EngineError('UNSUPPORTED_INPUT', 'This file has no audio track.');
      }
      info = probed;
      status = 'ready';
      onloaded?.(f, probed, engine());
    } catch (err) {
      if (file !== f) return;
      file = null;
      status = 'empty';
      showError(err);
    }
  }

  function requestRun() {
    if (!canRun || !file || !caps || !built || built.error || !plan) return;
    const verdict = assessMemory({
      inputSize: file.size,
      outputEstimate: built.estimate,
      caps: { fileSystemAccess: false, deviceMemory: caps.deviceMemory },
      path: plan.path,
    });
    // ?memtest (E23): any in-memory result on a device without save-to-disk triggers the warning.
    const forced = memtest && !caps.fileSystemAccess && verdict.sink === 'memory' && !verdict.block;
    if (verdict.block) {
      showError(new EngineError('OUT_OF_MEMORY', verdict.message));
      return;
    }
    if (verdict.warn || forced) {
      memoryMessage = verdict.warn
        ? verdict.message
        : 'The result is held in memory until you download it, which may be slow or fail on this device. You can continue or lower the quality.';
      status = 'confirm';
      return;
    }
    void run();
  }

  function lowerQuality() {
    onlowerquality?.();
    status = 'ready';
  }

  async function run() {
    if (!file || !built || built.error || !plan || plan.path === 'unsupported' || !plan.output) return;
    const token = ++runToken;
    controller = new AbortController();
    error = null;
    result = null;
    notice = plan.fallback ? plan.reason : '';
    progress = { phase: 'reading', ratio: 0 };
    status = 'running';
    const job = { ...built.job, output: plan.output } as Job;
    try {
      const r = await engine().run(job, file, { signal: controller.signal, slowMs, onProgress: (p) => token === runToken && (progress = p) });
      if (token !== runToken) return;
      result = r;
      status = 'done';
    } catch (err) {
      if (token !== runToken) return;
      status = 'ready';
      if (!(err instanceof EngineError && err.code === 'CANCELLED')) showError(err);
    } finally {
      if (token === runToken) {
        controller = null;
        progress = null;
      }
    }
  }

  function cancel() {
    // The worker stops in the background; the tool is usable again at once.
    controller?.abort();
    controller = null;
    runToken++;
    progress = null;
    status = 'ready';
  }

  function reset() {
    file = null;
    info = null;
    result = null;
    error = null;
    status = 'empty';
  }

  function seconds(s: number): string {
    const m = Math.floor(s / 60);
    const r = Math.round(s - m * 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  }
</script>

<section class="tool" aria-label={name}>
  <CapabilityBanner {missing} />
  {#if status === 'unsupported'}
    <UnsupportedBrowser reason={unsupportedReason} />
  {/if}

  {#if status !== 'running' && status !== 'done'}
    <DropZone {accept} label={dropLabel} hint="or press Enter to choose a file" disabled={status === 'unsupported'} {onfiles} />
  {/if}

  {#if error}
    <ErrorCard code={error.code} message={error.message} ondismiss={() => (error = null)} />
  {/if}

  {#if file && info}
    <div class="file card">
      <div class="file-row">
        <div>
          <p class="name">{file.name}</p>
          <p class="muted small">
            {#if info.width}{info.width}×{info.height} · {/if}{seconds(info.duration)}{info.videoCodec ? ` · ${info.videoCodec}` : ''}{info.audioCodec
              ? ` · ${info.audioCodec} audio`
              : ', no audio'}
          </p>
        </div>
        {#if plan}
          <span class="chip" data-testid="engine-chip">{chip}</span>
        {/if}
      </div>
      {#if showReason && plan}
        <p class="reason" data-testid="engine-reason">{plan.reason}</p>
      {/if}
      {#if built && !built.error && built.note}
        <p class="hint note">{built.note}</p>
      {/if}
      {#if built?.error}
        <p class="reason" role="alert">{built.error}</p>
      {/if}
    </div>
  {/if}

  {#if options && status !== 'running' && status !== 'done'}
    <div class="options card">
      {@render options()}
    </div>
  {/if}

  {#if status === 'confirm'}
    <div class="memory card" data-testid="memory-warning" role="alertdialog" aria-label="Memory warning">
      <p>{memoryMessage}</p>
      <div class="actions">
        <button type="button" class="btn" onclick={() => void run()}>Continue</button>
        <button type="button" class="btn btn-secondary" onclick={lowerQuality}>Lower quality</button>
      </div>
    </div>
  {/if}

  {#if status !== 'running' && status !== 'done' && status !== 'confirm'}
    <button type="button" class="btn run" data-testid="run" disabled={!canRun} onclick={requestRun}>{runLabel}</button>
  {/if}

  {#if status === 'probing'}
    <p class="muted" role="status">Reading the file…</p>
  {/if}

  {#if status === 'running'}
    <ProgressPanel {progress} oncancel={cancel} />
  {/if}

  {#if status === 'done' && result}
    <ExportPanel {result} {notice} onreset={reset} />
  {/if}

  <NetworkProof />
</section>

<style>
  .tool {
    display: grid;
    gap: var(--space-4);
  }
  .file-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
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
  .chip {
    padding: var(--space-1) var(--space-3);
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .reason {
    margin: var(--space-3) 0 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--warning-soft);
    font-size: 0.9rem;
  }
  .note {
    margin-top: var(--space-3);
  }
  .options {
    display: grid;
    gap: var(--space-3);
  }
  .memory {
    border-color: var(--warning);
    background: var(--warning-soft);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .run {
    justify-self: start;
  }
</style>
