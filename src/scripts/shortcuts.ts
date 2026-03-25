// Keyboard shortcuts sheet (<dialog id="shortcuts"> in Base.astro): "?" opens it, Tab stays inside, Esc closes it
// and focus returns to where it was. Also: O chooses a file, D switches the theme.
import { cycleTheme } from './theme';

const dialog = document.getElementById('shortcuts') as HTMLDialogElement | null;
let opener: HTMLElement | null = null;

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable;
}

function focusables(): HTMLElement[] {
  if (!dialog) return [];
  return [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
}

export function openShortcuts(): void {
  if (!dialog || dialog.open) return;
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.showModal();
  focusables()[0]?.focus();
}

dialog?.addEventListener('close', () => {
  const back = opener;
  opener = null;
  if (back && document.contains(back)) back.focus();
});

dialog?.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const items = focusables();
  if (items.length === 0) return;
  e.preventDefault();
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length;
  items[next].focus();
});

dialog?.addEventListener('click', (e) => {
  // A click on the backdrop (outside the sheet's box) closes it.
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
  }
});

for (const b of document.querySelectorAll<HTMLElement>('[data-open-shortcuts]')) b.addEventListener('click', openShortcuts);

document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
  if (dialog?.open) return;
  if (e.key === '?') {
    e.preventDefault();
    openShortcuts();
  } else if (e.key === 'o' || e.key === 'O') {
    const zone = document.querySelector<HTMLElement>('[data-testid="dropzone"] [role="button"]');
    if (zone && zone.getAttribute('aria-disabled') !== 'true') {
      e.preventDefault();
      zone.click();
    }
  } else if (e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    cycleTheme();
  }
});
