<script lang="ts">
  // Privacy page: removes every downloaded speech model from this browser and forgets "Remember my choice".
  import { deleteDownloadedModels } from '../subtitles/model-cache';
  import { createDownloadGate } from '../subtitles/download-gate';

  let message = $state('');
  let busy = $state(false);

  async function remove() {
    busy = true;
    try {
      const n = await deleteDownloadedModels();
      try {
        createDownloadGate(window.localStorage).forget();
      } catch {
        /* storage unavailable */
      }
      message = n > 0 ? 'Downloaded models were deleted from this browser.' : 'There were no downloaded models to delete.';
    } catch (err) {
      message = `Could not delete the models: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      busy = false;
    }
  }
</script>

<div class="delete">
  <button type="button" class="btn btn-secondary" disabled={busy} onclick={remove}>Delete downloaded models</button>
  <p class="muted" role="status" aria-live="polite">{message}</p>
</div>

<style>
  .delete {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
  }
  .delete p {
    margin: 0;
    min-height: 1.6em;
  }
</style>
