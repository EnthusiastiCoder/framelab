<script lang="ts">
  // Resize / crop video to 9:16, 1:1, 4:5 or 16:9 (or a free crop): crop it, fit it with padding, or fit it on a
  // blurred copy of itself. Every output size is even, as video encoders need.
  import ToolRunner, { type Built, type InputInfo } from '../ToolRunner.svelte';
  import CropOverlay from '../CropOverlay.svelte';
  import { ASPECTS, layoutFor, type Aspect, type CropMode, type Rect } from '../../engine/crop';
  import { sameFamilyVideo } from '../../lib/media-options';

  interface Props {
    aspect?: Aspect;
    mode?: CropMode;
  }
  let { aspect: initialAspect = '9:16', mode: initialMode = 'crop' }: Props = $props();

  // svelte-ignore state_referenced_locally
  let aspect = $state<Aspect>(initialAspect);
  // svelte-ignore state_referenced_locally
  let mode = $state<CropMode>(initialMode);
  let file = $state<File | null>(null);
  let size = $state<{ width: number; height: number } | null>(null);
  /** A crop window the user moved or resized, in source pixels; null = centred default. */
  let custom = $state<Rect | null>(null);

  const ratio = $derived(aspect === 'free' ? null : ASPECTS[aspect]);
  const defaultRect = $derived(size ? layoutFor(size, { aspect, mode: 'crop' }).source : null);
  const rect = $derived(custom ?? defaultRect);

  $effect(() => {
    // A new aspect ratio starts from the centred window again.
    void aspect;
    custom = null;
  });

  function onloaded(f: File, info: InputInfo) {
    file = f;
    size = info.width && info.height ? { width: info.width, height: info.height } : null;
    custom = null;
  }

  function layout(info: InputInfo) {
    const src = { width: info.width ?? 0, height: info.height ?? 0 };
    if (mode === 'crop' && custom) return layoutFor(src, { aspect: 'free', mode: 'crop', rect: custom });
    if (aspect === 'free') return layoutFor(src, { aspect, mode: 'crop', rect: custom ?? undefined });
    return layoutFor(src, { aspect, mode });
  }

  function build(info: InputInfo, f: File): Built {
    if (!info.width || !info.height) return { error: 'This video has no picture size to work with.' };
    const l = layout(info);
    const output = sameFamilyVideo(info);
    const pixels = (l.output.width * l.output.height) / (info.width * info.height);
    return {
      job: { op: 'resize', output, layout: l, blur: mode === 'fit-blur' && aspect !== 'free' },
      planner: { op: 'resize', output, transcode: true },
      estimate: Math.max(f.size, (3_000_000 * info.duration) / 8) * Math.max(0.3, pixels) * 1.5,
    };
  }
</script>

<ToolRunner name="Resize and crop video tool" runLabel="Resize video" {build} {onloaded}>
  {#snippet options()}
    <label class="field">
      Aspect ratio
      <select aria-label="Aspect ratio" bind:value={aspect}>
        <option value="9:16">9:16</option>
        <option value="1:1">1:1</option>
        <option value="4:5">4:5</option>
        <option value="16:9">16:9</option>
        <option value="free">Free</option>
      </select>
    </label>
    <fieldset class="choices" disabled={aspect === 'free'}>
      <legend>Fit</legend>
      <label><input type="radio" name="resize-mode" value="crop" bind:group={mode} /> Crop</label>
      <label><input type="radio" name="resize-mode" value="fit-pad" bind:group={mode} /> Fit with padding</label>
      <label><input type="radio" name="resize-mode" value="fit-blur" bind:group={mode} /> Fit with blur</label>
    </fieldset>
    {#if file && size && rect && (mode === 'crop' || aspect === 'free')}
      <CropOverlay {file} width={size.width} height={size.height} {ratio} {rect} onchange={(r) => (custom = r)} />
      <p class="hint">Drag the bright window to choose what stays in the picture.</p>
    {:else}
      <p class="hint">Fit keeps the whole picture and fills the rest with black bars or a blurred copy.</p>
    {/if}
  {/snippet}
</ToolRunner>
