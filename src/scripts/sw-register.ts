// Registers the service worker (offline use after the first visit) and offers a reload when an update waits.
import { toast } from './toasts';

function offerUpdate(worker: ServiceWorker) {
  toast('A new version of Framelab is ready.', {
    action: {
      label: 'Reload',
      onClick: () => {
        navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
        worker.postMessage('SKIP_WAITING');
      },
    },
  });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        next?.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(next);
        });
      });
    } catch {
      /* offline support is optional; the site works without it */
    }
  });
}
