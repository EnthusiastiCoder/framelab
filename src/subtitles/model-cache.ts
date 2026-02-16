// Which models this browser already holds. transformers.js stores every model file in the Cache API under
// 'transformers-cache', keyed by the whole-file URL on our origin (see asr-worker.ts).

import { modelFileUrl, type WhisperModel } from './models';

export const MODEL_CACHE = 'transformers-cache';
/** Cache names the privacy page clears. */
export const MODEL_CACHE_PATTERN = /transformers|model/i;

/** True when every file of the model is in the cache (no network request is made). */
export async function isModelCached(model: WhisperModel, origin = location.origin): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    if (!(await caches.has(MODEL_CACHE))) return false;
    const cache = await caches.open(MODEL_CACHE);
    for (const f of model.files) {
      if (!(await cache.match(origin + modelFileUrl(model, f.path)))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Deletes every cache that holds downloaded models; returns how many entries were removed. */
export async function deleteDownloadedModels(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  let removed = 0;
  for (const name of await caches.keys()) {
    if (!MODEL_CACHE_PATTERN.test(name)) continue;
    const cache = await caches.open(name);
    for (const k of await cache.keys()) if (await cache.delete(k)) removed++;
    await caches.delete(name);
  }
  return removed;
}
