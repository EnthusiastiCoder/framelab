<script lang="ts">
  // Lists, in plain words, the browser features this tool would like but cannot find. Renders nothing when none are missing.
  interface Props {
    missing: string[];
  }

  let { missing }: Props = $props();
</script>

{#if missing.length > 0}
  <div class="banner" data-testid="capability-banner" role="note">
    <p><strong>Some browser features are missing here:</strong> {missing.join(', ')}.</p>
    <p>For the best results, use a recent Chrome, Edge, Safari or Firefox.</p>
  </div>
{/if}

<style>
  .banner {
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--warning);
    border-radius: var(--radius);
    background: var(--warning-soft);
    color: var(--text);
    margin-bottom: var(--space-4);
  }
  .banner p {
    margin: 0;
  }
  .banner p + p {
    margin-top: var(--space-1);
    color: var(--text-muted);
  }
</style>
