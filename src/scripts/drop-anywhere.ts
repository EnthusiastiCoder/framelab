// Drop a file anywhere on the page. On a tool page it goes to the tool's file input; on other pages it opens the
// matching tool (video: Compress video, audio: Audio converter) via the local hand-off.
import { sendTo } from '../lib/handoff';

function hasFiles(e: DragEvent): boolean {
  return !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
}

function toolFor(file: File): string | null {
  if (file.type.startsWith('video/')) return 'compress-video';
  if (file.type.startsWith('audio/')) return 'audio-converter';
  return null;
}

document.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('drop', (e) => {
  if (!hasFiles(e) || !e.dataTransfer) return;
  const target = e.target as Element | null;
  if (target?.closest?.('[data-testid="dropzone"]')) return; // the drop zone handles its own drops
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (files.length === 0) return;
  const input = document.querySelector<HTMLInputElement>('[data-testid="dropzone"] input[type="file"]');
  if (input) {
    input.files = files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (document.querySelector('[data-tool-page]')) return; // a tool is busy or showing its result
  const file = files[0];
  const slug = toolFor(file);
  if (slug) void sendTo(slug, file, file.name, file.type);
  else window.dispatchEvent(new CustomEvent('framelab:toast', { detail: { message: 'Drop a video or an audio file.' } }));
});
