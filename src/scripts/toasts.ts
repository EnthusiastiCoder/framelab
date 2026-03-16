// Toasts in a polite aria-live region (#toasts in Base.astro). Islands dispatch a "framelab:toast" event.
export interface ToastOptions {
  action?: { label: string; onClick: () => void };
  timeout?: number;
}

export function toast(message: string, opts: ToastOptions = {}): void {
  const region = document.getElementById('toasts');
  if (!region) return;
  const item = document.createElement('div');
  item.className = 'toast';
  const text = document.createElement('span');
  text.textContent = message;
  item.append(text);
  if (opts.action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary';
    button.textContent = opts.action.label;
    button.addEventListener('click', () => {
      item.remove();
      opts.action!.onClick();
    });
    item.append(button);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  close.addEventListener('click', () => item.remove());
  item.append(close);
  region.append(item);
  const timeout = opts.timeout ?? (opts.action ? 0 : 6000);
  if (timeout > 0) setTimeout(() => item.remove(), timeout);
}

window.addEventListener('framelab:toast', (e) => {
  const detail = (e as CustomEvent<{ message: string }>).detail;
  if (detail?.message) toast(detail.message);
});
