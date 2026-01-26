<script lang="ts">
  // Live proof that nothing leaves the device: counts resource requests to other origins (PerformanceObserver).
  import { onMount } from 'svelte';

  let external = $state<string[]>([]);

  onMount(() => {
    const seen = new Set<string>();
    const check = (name: string) => {
      if (name.startsWith('data:') || name.startsWith('blob:')) return;
      try {
        if (new URL(name).origin !== location.origin && !seen.has(name)) {
          seen.add(name);
          external = [...seen];
        }
      } catch {
        /* ignore unparsable entries */
      }
    };
    for (const e of performance.getEntriesByType('resource')) check(e.name);
    if (typeof PerformanceObserver !== 'function') return;
    const observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) check(e.name);
    });
    try {
      observer.observe({ type: 'resource', buffered: true });
    } catch {
      return;
    }
    return () => observer.disconnect();
  });
</script>

<p class="proof" class:bad={external.length > 0} data-testid="network-proof" aria-live="polite">
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
    ><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"></path><path d="m9 12 2 2 4-4"></path></svg
  >
  {#if external.length === 0}
    0 requests to other sites
  {:else}
    {external.length} request{external.length === 1 ? '' : 's'} to other sites: {external.map((u) => new URL(u).host).join(', ')}
  {/if}
</p>

<style>
  .proof {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-1) var(--space-3);
    border-radius: 999px;
    background: var(--success-soft);
    color: var(--success);
    font-size: 0.9rem;
    font-weight: 600;
  }
  .proof.bad {
    background: var(--danger-soft);
    color: var(--danger);
  }
</style>
