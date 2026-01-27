<script lang="ts">
  // Mute video: removes the audio track and copies the video stream unchanged (WebCodecs path, no re-encode).
  import { onMount } from 'svelte';
  import DropZone from '../DropZone.svelte';
  import ProgressPanel from '../ProgressPanel.svelte';
  import ExportPanel from '../ExportPanel.svelte';
  import ErrorCard from '../ErrorCard.svelte';
  import CapabilityBanner from '../CapabilityBanner.svelte';
  import NetworkProof from '../NetworkProof.svelte';
  import UnsupportedBrowser from '../UnsupportedBrowser.svelte';
  import { detectCapabilities, missingFeatures } from '../../engine/capabilities';
  import { planPath } from '../../engine/planner';
  import { EngineClient } from '../../engine/client';
  import { EngineError, toErrorCode, type EngineErrorCode, type InputInfo, type Progress, type Result } from '../../engine/types';

  type Status = 'checking' | 'unsupported' | 'empty' | 'probing' | 'ready' | 'running' | 'done';

  let status = $state<Status>('checking');
  let missing = $state<string[]>([]);
  let unsupportedReason = $state('');
  let file = $state<File | null>(null);
  let info = $state<InputInfo | null>(null);
  let progress = $state<Progress | null>(null);
  let result = $state<Result | null>(null);
  let error = $state<{ code: EngineErrorCode; message: string } | null>(null);

  let client: EngineClient | null = null;
  let controller: AbortController | null = null;
  let slowMs = 0;

  onMount(() => {
    slowMs = new URLSearchParams(location.search).get('slow') === '1' ? 3000 : 0;
    let alive = true;
    detectCapabilities(window).then((caps) => {
      if (!alive) return;
      missing = missingFeatures(caps);
      const plan = planPath({ op: 'mute' }, caps, {});
      if (plan.path === 'unsupported') {
        unsupportedReason = plan.reason;
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
      if (probed.videoTracks === 0) {
        throw new EngineError('UNSUPPORTED_INPUT', 'This file has no video track. To change audio, use an audio tool.');
      }
      info = probed;
      status = 'ready';
    } catch (err) {
      if (file !== f) return;
      file = null;
      status = 'empty';
      showError(err);
    }
  }

  async function run() {
    if (!file || status !== 'ready') return;
    controller = new AbortController();
    error = null;
    result = null;
    progress = { phase: 'reading', ratio: 0 };
    status = 'running';
    try {
      result = await engine().run({ op: 'mute' }, file, {
        signal: controller.signal,
        slowMs,
        onProgress: (p) => (progress = p),
      });
      status = 'done';
    } catch (err) {
      status = 'ready';
      if (!(err instanceof EngineError && err.code === 'CANCELLED')) showError(err);
    } finally {
      controller = null;
      progress = null;
    }
  }

  function cancel() {
    controller?.abort();
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

<section class="tool" aria-label="Mute video tool">
  <CapabilityBanner {missing} />
  {#if status === 'unsupported'}
    <UnsupportedBrowser reason={unsupportedReason} />
  {/if}

  {#if status !== 'running' && status !== 'done'}
    <DropZone accept="video/*" label="Drop a video here" hint="or press Enter to choose a file" disabled={status === 'unsupported'} {onfiles} />
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
            {info.width}×{info.height} · {seconds(info.duration)} · {info.videoCodec ?? 'video'}{info.audioCodec ? ` + ${info.audioCodec} audio` : ', no audio'}
          </p>
        </div>
        <span class="chip" data-testid="engine-chip">Engine: Fast (WebCodecs)</span>
      </div>
      {#if status === 'ready'}
        <button type="button" class="btn" data-testid="run" onclick={run}>Mute video</button>
      {/if}
    </div>
  {:else if status !== 'running' && status !== 'done'}
    <button type="button" class="btn run-idle" data-testid="run" disabled>Mute video</button>
  {/if}

  {#if status === 'probing'}
    <p class="muted" role="status">Reading the file…</p>
  {/if}

  {#if status === 'running'}
    <ProgressPanel {progress} oncancel={cancel} />
  {/if}

  {#if status === 'done' && result}
    <ExportPanel {result} onreset={reset} />
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
    margin-bottom: var(--space-4);
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
  .run-idle {
    justify-self: start;
  }
</style>
