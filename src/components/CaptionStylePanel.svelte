<script lang="ts">
  // Burn-in caption style: position, size and background box.
  import type { CaptionStyle } from '../subtitles/style';

  interface Props {
    style: CaptionStyle;
  }

  let { style = $bindable() }: Props = $props();

  const SIZES = { small: 0.04, medium: 0.05, large: 0.065 } as const;
  type Size = keyof typeof SIZES;
  const sizeOf = (s: number): Size => (s <= 0.045 ? 'small' : s >= 0.06 ? 'large' : 'medium');

  const BOX = 'rgba(0, 0, 0, 0.62)';
  const NO_BOX = 'rgba(0, 0, 0, 0)';
</script>

<fieldset class="style">
  <legend>Caption style</legend>
  <div class="field-row">
    <label class="field">
      Position
      <select value={style.position} onchange={(e) => (style = { ...style, position: e.currentTarget.value as CaptionStyle['position'] })}>
        <option value="bottom">Bottom</option>
        <option value="top">Top</option>
      </select>
    </label>
    <label class="field">
      Text size
      <select value={sizeOf(style.fontScale)} onchange={(e) => (style = { ...style, fontScale: SIZES[e.currentTarget.value as Size] })}>
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
    </label>
  </div>
  <label class="check">
    <input
      type="checkbox"
      checked={style.boxColor !== NO_BOX}
      onchange={(e) => (style = { ...style, boxColor: e.currentTarget.checked ? BOX : NO_BOX })}
    />
    Dark box behind the text
  </label>
</fieldset>

<style>
  .style {
    border: 0;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  legend {
    font-weight: 600;
    padding: 0;
    margin-bottom: var(--space-2);
  }
  .check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
</style>
