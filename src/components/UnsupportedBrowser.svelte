<script lang="ts">
  // Shown instead of a broken tool when the browser lacks WebCodecs. No silent failure.
  interface Props {
    reason?: string;
  }

  let { reason = '' }: Props = $props();
</script>

<div class="unsupported card" data-testid="unsupported-browser" role="alert">
  <p class="title">This tool is not supported in this browser</p>
  <p>
    Framelab processes video right on your device with WebCodecs, and this browser does not provide it{reason ? ` (${reason})` : ''}.
  </p>
  <p><strong>Use Chrome, Edge, Safari or a recent Firefox</strong>, then open this page again. Nothing was uploaded.</p>
</div>

<style>
  .unsupported {
    border-color: var(--warning);
    background: var(--warning-soft);
    margin-bottom: var(--space-4);
  }
  .title {
    font-weight: 700;
    font-size: 1.1rem;
    margin-bottom: var(--space-2);
  }
  p:last-child {
    margin-bottom: 0;
  }
</style>
