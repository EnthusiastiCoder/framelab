// PURE memory and output-size policy.
// WebCodecs streams its input, so there is no input limit. The output goes to disk (File System Access) when
// available, which allows any size; otherwise it is held in memory: warn above 512 MiB on devices with
// deviceMemory <= 4 (1 GiB elsewhere), block above 2 GiB. A warning never blocks; the user can continue.

import type { EnginePath } from './types';

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

export interface MemoryInput {
  inputSize: number;
  outputEstimate: number;
  caps: { fileSystemAccess: boolean; deviceMemory: number | null };
  path: EnginePath | string;
}

export interface MemoryVerdict {
  ok: boolean;
  sink: 'disk' | 'memory';
  warn?: boolean;
  block?: boolean;
  message: string;
}

export const MEMORY_BLOCK_BYTES = 2 * GiB;

export function warnThreshold(deviceMemory: number | null): number {
  return deviceMemory !== null && deviceMemory <= 4 ? 512 * MiB : 1 * GiB;
}

const fmt = (bytes: number) => (bytes >= GiB ? `${(bytes / GiB).toFixed(1)} GB` : `${Math.round(bytes / MiB)} MB`);

export function assessMemory({ outputEstimate, caps }: MemoryInput): MemoryVerdict {
  if (caps.fileSystemAccess) {
    return { ok: true, sink: 'disk', message: 'The result is written straight to disk, so any size works.' };
  }
  if (outputEstimate > MEMORY_BLOCK_BYTES) {
    return {
      ok: false,
      sink: 'memory',
      block: true,
      message: `The result (about ${fmt(outputEstimate)}) is too large to hold in this browser's memory. Lower the quality or resolution, or use Chrome or Edge, which can save straight to disk.`,
    };
  }
  if (outputEstimate > warnThreshold(caps.deviceMemory)) {
    return {
      ok: true,
      sink: 'memory',
      warn: true,
      message: `The result (about ${fmt(outputEstimate)}) is held in memory until you download it, which may be slow or fail on this device. You can continue or lower the quality.`,
    };
  }
  return { ok: true, sink: 'memory', message: 'The result is kept in memory until you download it.' };
}
