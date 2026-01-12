// U20 models: src/subtitles/models.ts (PURE)
// API: MODELS: Array<{ id: string; revision: string; bytes: number; label: string; ... }>
//      DEFAULT_MODEL_ID: string
//      modelFileUrls(model): string[]   (every file the runtime fetches for that model)
// Decision 3 (WS0): models are self-hosted on our own origin (chunked under the 25 MiB file cap),
// so every URL is a same-origin path; no Hugging Face (or any other) host. The revision pin records
// which upstream snapshot was vendored.
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/subtitles/models');

describe('U20 model registry', () => {
  it('lists whisper-tiny, whisper-base and whisper-small', async () => {
    const { MODELS } = await load();
    const ids = MODELS.map((m: { id: string }) => m.id).join(' ');
    expect(ids).toContain('whisper-tiny');
    expect(ids).toContain('whisper-base');
    expect(ids).toContain('whisper-small');
  });

  it('every model has a 40-hex revision, a byte size above 0 and a label with the size in MB', async () => {
    const { MODELS } = await load();
    expect(MODELS.length).toBeGreaterThanOrEqual(3);
    for (const m of MODELS) {
      expect(m.revision, m.id).toMatch(/^[0-9a-f]{40}$/);
      expect(m.bytes, m.id).toBeGreaterThan(0);
      expect(m.label, m.id).toMatch(/\d+(\.\d+)?\s?MB/);
      const mb = Math.round(m.bytes / 1e6);
      const labelled = Number(/(\d+(?:\.\d+)?)\s?MB/.exec(m.label)![1]);
      expect(Math.abs(labelled - mb), `${m.id} label vs bytes`).toBeLessThanOrEqual(Math.max(1, mb * 0.05));
    }
  });

  it('the default model is whisper-base', async () => {
    const { MODELS, DEFAULT_MODEL_ID } = await load();
    expect(DEFAULT_MODEL_ID).toContain('whisper-base');
    expect(MODELS.some((m: { id: string }) => m.id === DEFAULT_MODEL_ID)).toBe(true);
  });

  it('every model URL is a same-origin path (no third-party host)', async () => {
    const { MODELS, modelFileUrls } = await load();
    for (const m of MODELS) {
      const urls: string[] = modelFileUrls(m);
      expect(urls.length, m.id).toBeGreaterThan(0);
      for (const u of urls) {
        expect(u, u).toMatch(/^\/[^/]/);
        expect(u).not.toMatch(/^[a-z]+:/i);
        expect(u.toLowerCase()).not.toContain('huggingface');
        // resolving against our origin keeps the origin
        expect(new URL(u, 'https://framelab.pages.dev').origin).toBe('https://framelab.pages.dev');
      }
    }
  });
});
