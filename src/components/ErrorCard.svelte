<script lang="ts">
  // Error card: what went wrong in plain words, and one concrete next step.
  import { NEXT_STEPS, type EngineErrorCode } from '../engine/types';

  interface Props {
    code: EngineErrorCode;
    message: string;
    ondismiss?: () => void;
  }

  let { code, message, ondismiss }: Props = $props();

  const TITLE: Record<EngineErrorCode, string> = {
    UNSUPPORTED_INPUT: 'Framelab cannot work with this file',
    UNSUPPORTED_OUTPUT: 'This output is not available here',
    UNSUPPORTED_BROWSER: 'Your browser cannot do this yet',
    OUT_OF_MEMORY: 'Your device ran out of memory',
    CORRUPT_INPUT: 'This file could not be read',
    CANCELLED: 'Cancelled',
    INTERNAL: 'Something went wrong',
  };
</script>

<div class="error card" data-testid="error-card" role="alert">
  <p class="title">{TITLE[code]}</p>
  <p class="message">{message}</p>
  <p class="next" data-testid="error-next-step"><strong>Next step:</strong> {NEXT_STEPS[code]}</p>
  {#if ondismiss}<button type="button" class="btn btn-secondary" onclick={ondismiss}>Dismiss</button>{/if}
</div>

<style>
  .error {
    border-color: var(--danger);
    background: var(--danger-soft);
  }
  .title {
    color: var(--danger);
    font-weight: 700;
    margin-bottom: var(--space-2);
  }
  .next {
    margin-bottom: var(--space-3);
  }
</style>
