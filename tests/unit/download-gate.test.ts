// U23 model download state: src/subtitles/download-gate.ts (PURE)
// Decision 3 (WS0) replaced the Hugging Face consent dialog with a same-origin, on-demand download
// that still shows a size notice first. The gate keeps the original U23 rules:
// no confirmation -> no download; "Remember my choice" persists; a cached model needs 0 MB.
// API: createDownloadGate(storage: { getItem(k): string | null; setItem(k, v): void; removeItem(k): void })
//        -> { allowed(): boolean; confirm(remember: boolean): void; forget(): void }
//      bytesToDownload(model: { bytes: number }, cached: boolean): number
//      noticeText(model: { label: string; bytes: number }, cached: boolean): string
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/subtitles/download-gate');

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    size: () => m.size,
  };
}

const model = { id: 'onnx-community/whisper-base', label: 'Base (balanced), 145 MB', bytes: 145_000_000 };

describe('U23 download gate', () => {
  it('does not allow a download before the user confirms', async () => {
    const { createDownloadGate } = await load();
    expect(createDownloadGate(memoryStorage()).allowed()).toBe(false);
  });

  it('confirm without remember allows this session only', async () => {
    const { createDownloadGate } = await load();
    const storage = memoryStorage();
    const gate = createDownloadGate(storage);
    gate.confirm(false);
    expect(gate.allowed()).toBe(true);
    expect(createDownloadGate(storage).allowed()).toBe(false);
  });

  it('"Remember my choice" persists across gates on the same storage', async () => {
    const { createDownloadGate } = await load();
    const storage = memoryStorage();
    createDownloadGate(storage).confirm(true);
    expect(storage.size()).toBeGreaterThan(0);
    expect(createDownloadGate(storage).allowed()).toBe(true);
  });

  it('forget clears the remembered choice', async () => {
    const { createDownloadGate } = await load();
    const storage = memoryStorage();
    const gate = createDownloadGate(storage);
    gate.confirm(true);
    gate.forget();
    expect(gate.allowed()).toBe(false);
    expect(createDownloadGate(storage).allowed()).toBe(false);
  });

  it('a cached model needs 0 bytes; an uncached one needs its full size', async () => {
    const { bytesToDownload } = await load();
    expect(bytesToDownload(model, true)).toBe(0);
    expect(bytesToDownload(model, false)).toBe(145_000_000);
  });

  it('the notice shows the size, 0 MB when cached, says audio stays local and names no third party', async () => {
    const { noticeText } = await load();
    const fresh = noticeText(model, false);
    expect(fresh).toMatch(/145\s?MB/);
    expect(fresh.toLowerCase()).toMatch(/never leaves (this|your) device/);
    expect(fresh.toLowerCase()).not.toContain('hugging');
    expect(noticeText(model, true)).toMatch(/\b0\s?MB/);
  });
});
