// U7 check-dist (pure function): scripts/check-dist.mjs
// API: export function checkDist({ files, headers }): string[]   (a list of problems; empty means pass)
//   files: Array<{ path: string; size: number; text?: string }>  (paths relative to dist/, '/' separators)
//   headers: string | null   (the text of dist/_headers, or null when the file is missing)
// The module must not run its CLI when imported (guard the main block).
// Decision 3 (WS0): models are self-hosted, so no Hugging Face host is allowlisted any more.
import { describe, it, expect } from 'vitest';

const load = () => import('../../scripts/check-dist.mjs');

const MiB = 1024 * 1024;

const GOOD_HEADERS = `/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; object-src 'none'
`;

const NO_COEP_HEADERS = `/*
  Cross-Origin-Opener-Policy: same-origin
  Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'
`;

const cleanFiles = () => [
  {
    path: 'index.html',
    size: 2048,
    text: '<!doctype html><html><body><h1>Framelab</h1><script type="module" src="/_astro/app.js"></script></body></html>',
  },
  { path: '_astro/app.js', size: 1024, text: 'export const a = 1;' },
  { path: 'icons/logo.svg', size: 300, text: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' },
];

describe('U7 check-dist', () => {
  it('passes a clean dist', async () => {
    const { checkDist } = await load();
    expect(checkDist({ files: cleanFiles(), headers: GOOD_HEADERS })).toEqual([]);
  });

  it('flags a 26 MiB file', async () => {
    const { checkDist } = await load();
    const files = [...cleanFiles(), { path: 'vendor/ffmpeg-core.wasm', size: 26 * MiB }];
    const problems = checkDist({ files, headers: GOOD_HEADERS });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toContain('vendor/ffmpeg-core.wasm');
  });

  it('accepts a file of 24 MiB', async () => {
    const { checkDist } = await load();
    const files = [...cleanFiles(), { path: 'vendor/ffmpeg-core.wasm.part0', size: 24 * MiB }];
    expect(checkDist({ files, headers: GOOD_HEADERS })).toEqual([]);
  });

  it('flags https://cdn.jsdelivr.net inside a JS file', async () => {
    const { checkDist } = await load();
    const files = [
      ...cleanFiles(),
      { path: '_astro/worker.js', size: 100, text: 'fetch("https://cdn.jsdelivr.net/npm/x/ort.wasm")' },
    ];
    const problems = checkDist({ files, headers: GOOD_HEADERS });
    expect(problems.join('\n')).toContain('cdn.jsdelivr.net');
  });

  it('flags https://huggingface.co inside a JS file (models are self-hosted)', async () => {
    const { checkDist } = await load();
    const files = [
      ...cleanFiles(),
      { path: '_astro/asr.js', size: 100, text: 'const u = "https://huggingface.co/onnx-community/whisper-base";' },
    ];
    const problems = checkDist({ files, headers: GOOD_HEADERS });
    expect(problems.join('\n')).toContain('huggingface.co');
  });

  it('allows licence and source links on /licenses and /about', async () => {
    const { checkDist } = await load();
    const files = [
      ...cleanFiles(),
      {
        path: 'licenses/index.html',
        size: 500,
        text: '<a href="https://github.com/ffmpegwasm/ffmpeg.wasm">source</a> <a href="https://www.gnu.org/licenses/lgpl-2.1.html">LGPL</a>',
      },
      { path: 'about/index.html', size: 500, text: '<a href="https://github.com/Vanilagy/mediabunny">mediabunny</a>' },
    ];
    expect(checkDist({ files, headers: GOOD_HEADERS })).toEqual([]);
  });

  it('flags the same external link on a tool page', async () => {
    const { checkDist } = await load();
    const files = [
      ...cleanFiles(),
      { path: 'compress-video/index.html', size: 500, text: '<a href="https://github.com/ffmpegwasm/ffmpeg.wasm">x</a>' },
    ];
    expect(checkDist({ files, headers: GOOD_HEADERS }).length).toBeGreaterThan(0);
  });

  it('flags a missing COEP header', async () => {
    const { checkDist } = await load();
    const problems = checkDist({ files: cleanFiles(), headers: NO_COEP_HEADERS });
    expect(problems.join('\n')).toMatch(/Cross-Origin-Embedder-Policy|COEP/i);
  });

  it('flags a missing _headers file', async () => {
    const { checkDist } = await load();
    expect(checkDist({ files: cleanFiles(), headers: null }).length).toBeGreaterThan(0);
  });
});
