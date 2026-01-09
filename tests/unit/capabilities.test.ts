// U4 capabilities: src/engine/capabilities.ts
// API: detectCapabilities(g: object = globalThis): Promise<Capabilities>
//   Capabilities: { webCodecs, videoEncoder, videoDecoder, audioEncoder, audioDecoder, crossOriginIsolated,
//                   sharedArrayBuffer, fileSystemAccess, deviceMemory: number | null, webGPU, offscreenCanvas,
//                   canEncode: Record<string, boolean>, canDecode: Record<string, boolean> }
//   `g` is the global scope to inspect, so tests can pass mocked globals.
import { describe, it, expect } from 'vitest';

const load = () => import('../../src/engine/capabilities');

describe('U4 capabilities', () => {
  it('reports every flag as missing on a bare global and does not throw', async () => {
    const { detectCapabilities } = await load();
    const bare = { navigator: {} };
    const caps = await detectCapabilities(bare);
    expect(caps.webCodecs).toBe(false);
    expect(caps.videoEncoder).toBe(false);
    expect(caps.videoDecoder).toBe(false);
    expect(caps.audioEncoder).toBe(false);
    expect(caps.audioDecoder).toBe(false);
    expect(caps.crossOriginIsolated).toBe(false);
    expect(caps.sharedArrayBuffer).toBe(false);
    expect(caps.fileSystemAccess).toBe(false);
    expect(caps.webGPU).toBe(false);
    expect(caps.offscreenCanvas).toBe(false);
    expect(caps.deviceMemory).toBeNull();
    expect(Object.values(caps.canEncode).every((v) => v === false)).toBe(true);
    expect(Object.values(caps.canDecode).every((v) => v === false)).toBe(true);
  });

  it('does not throw when navigator itself is missing', async () => {
    const { detectCapabilities } = await load();
    await expect(detectCapabilities({})).resolves.toBeDefined();
  });

  it('reports present features from mocked globals', async () => {
    const { detectCapabilities } = await load();
    const mocked = {
      navigator: { gpu: {}, deviceMemory: 8 },
      crossOriginIsolated: true,
      SharedArrayBuffer,
      showSaveFilePicker: () => Promise.resolve({}),
      OffscreenCanvas: class {},
    };
    const caps = await detectCapabilities(mocked);
    expect(caps.crossOriginIsolated).toBe(true);
    expect(caps.sharedArrayBuffer).toBe(true);
    expect(caps.fileSystemAccess).toBe(true);
    expect(caps.webGPU).toBe(true);
    expect(caps.offscreenCanvas).toBe(true);
    expect(caps.deviceMemory).toBe(8);
    // No VideoEncoder in the mock, so WebCodecs is still reported missing.
    expect(caps.webCodecs).toBe(false);
    expect(caps.videoEncoder).toBe(false);
  });

  it('crossOriginIsolated=false is reported as false, not missing-as-true', async () => {
    const { detectCapabilities } = await load();
    const caps = await detectCapabilities({ navigator: {}, crossOriginIsolated: false, SharedArrayBuffer });
    expect(caps.crossOriginIsolated).toBe(false);
  });
});
