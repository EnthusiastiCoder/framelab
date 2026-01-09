// U3 memory: src/engine/memory.ts (PURE)
// API: assessMemory({ inputSize, outputEstimate, caps: { fileSystemAccess, deviceMemory }, path })
//   -> { ok: boolean; sink: 'disk' | 'memory'; warn?: boolean; block?: boolean; message: string }
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/engine/memory');

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

describe('U3 memory policy', () => {
  it('chooses the disk sink when FSA is available and accepts any size', async () => {
    const { assessMemory } = await load();
    const r = assessMemory({
      inputSize: 10 * GiB,
      outputEstimate: 8 * GiB,
      caps: { fileSystemAccess: true, deviceMemory: 4 },
      path: 'webcodecs',
    });
    expect(r.sink).toBe('disk');
    expect(r.ok).toBe(true);
    expect(r.block).toBeFalsy();
    expect(r.warn).toBeFalsy();
  });

  it('memory sink with deviceMemory=4: no warning at 512 MiB, warning above it', async () => {
    const { assessMemory } = await load();
    const caps = { fileSystemAccess: false, deviceMemory: 4 };
    const at = assessMemory({ inputSize: 100 * MiB, outputEstimate: 512 * MiB, caps, path: 'webcodecs' });
    expect(at.sink).toBe('memory');
    expect(at.warn).toBeFalsy();
    const over = assessMemory({ inputSize: 100 * MiB, outputEstimate: 513 * MiB, caps, path: 'webcodecs' });
    expect(over.sink).toBe('memory');
    expect(over.warn).toBe(true);
    expect(over.ok).toBe(true);
    expect(over.message.length).toBeGreaterThan(0);
  });

  it('memory sink with deviceMemory=8: no warning at 1 GiB, warning above it', async () => {
    const { assessMemory } = await load();
    const caps = { fileSystemAccess: false, deviceMemory: 8 };
    const mid = assessMemory({ inputSize: 100 * MiB, outputEstimate: 800 * MiB, caps, path: 'webcodecs' });
    expect(mid.warn).toBeFalsy();
    const at = assessMemory({ inputSize: 100 * MiB, outputEstimate: 1 * GiB, caps, path: 'webcodecs' });
    expect(at.warn).toBeFalsy();
    const over = assessMemory({ inputSize: 100 * MiB, outputEstimate: 1 * GiB + MiB, caps, path: 'webcodecs' });
    expect(over.warn).toBe(true);
    expect(over.block).toBeFalsy();
  });

  it('memory sink blocks above 2 GiB with an explanation', async () => {
    const { assessMemory } = await load();
    const r = assessMemory({
      inputSize: 100 * MiB,
      outputEstimate: 2 * GiB + MiB,
      caps: { fileSystemAccess: false, deviceMemory: 8 },
      path: 'webcodecs',
    });
    expect(r.block).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.message.length).toBeGreaterThan(0);
  });

  it('ffmpeg path blocks input over 2 GiB and mentions Chrome/Edge', async () => {
    const { assessMemory } = await load();
    const r = assessMemory({
      inputSize: 2 * GiB + MiB,
      outputEstimate: 100 * MiB,
      caps: { fileSystemAccess: true, deviceMemory: 8 },
      path: 'ffmpeg',
    });
    expect(r.block).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Chrome|Edge/);
  });

  it('webcodecs path has no input size limit', async () => {
    const { assessMemory } = await load();
    const r = assessMemory({
      inputSize: 50 * GiB,
      outputEstimate: 100 * MiB,
      caps: { fileSystemAccess: false, deviceMemory: 8 },
      path: 'webcodecs',
    });
    expect(r.block).toBeFalsy();
    expect(r.ok).toBe(true);
  });

  it('a warning never sets block', async () => {
    const { assessMemory } = await load();
    for (const [deviceMemory, size] of [[2, 600 * MiB], [4, 1.5 * GiB], [8, 1.9 * GiB]] as const) {
      const r = assessMemory({
        inputSize: 10 * MiB,
        outputEstimate: size,
        caps: { fileSystemAccess: false, deviceMemory },
        path: 'webcodecs',
      });
      expect(r.warn).toBe(true);
      expect(r.block).toBeFalsy();
      expect(r.ok).toBe(true);
    }
  });
});
