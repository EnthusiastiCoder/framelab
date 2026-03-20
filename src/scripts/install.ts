// "Install app" in the header menu: shown only when the browser offers installation.
import { toast } from './toasts';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const button = document.getElementById('install-app') as HTMLButtonElement | null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  if (button) button.hidden = false;
});

button?.addEventListener('click', async () => {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  button.hidden = true;
});

window.addEventListener('appinstalled', () => {
  if (button) button.hidden = true;
  toast('Framelab is installed. It works offline too.');
});
