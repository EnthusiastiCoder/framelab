// Same-origin asset loader for large files that ship in parts (each under the 25 MiB Cloudflare Pages cap),
// e.g. the self-hosted Whisper models. Parts are listed in public/vendor/manifest.json by scripts/vendor-assets.mjs.

export interface VendorPartEntry {
  /** URL path of the joined file, e.g. "/vendor/models/whisper-base/encoder.onnx". */
  path: string;
  size: number;
  sha256: string;
  /** URL paths of the parts, in order. A single-part file lists itself. */
  parts: string[];
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Joins the parts into one Blob and verifies its SHA-256; rejects on a mismatch. */
export async function assembleParts(parts: Array<ArrayBuffer | Uint8Array>, expectedSha256: string): Promise<Blob> {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    joined.set(p instanceof Uint8Array ? p : new Uint8Array(p), offset);
    offset += p.byteLength;
  }
  const digest = toHex(await crypto.subtle.digest('SHA-256', joined));
  if (digest !== expectedSha256.toLowerCase()) {
    throw new Error(`asset integrity check failed: expected sha256 ${expectedSha256}, got ${digest}`);
  }
  return new Blob([joined]);
}

/** Fetches every part of a manifest entry from the same origin and reassembles it. */
export async function loadAsset(entry: VendorPartEntry, onProgress?: (ratio: number) => void): Promise<Blob> {
  const parts: ArrayBuffer[] = [];
  let loaded = 0;
  for (const url of entry.parts) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not load ${url}: HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    parts.push(buf);
    loaded += buf.byteLength;
    onProgress?.(entry.size ? loaded / entry.size : 1);
  }
  return assembleParts(parts, entry.sha256);
}

/** Blob URL for an assembled asset (revoke it when done). */
export async function assetUrl(entry: VendorPartEntry, onProgress?: (ratio: number) => void): Promise<string> {
  return URL.createObjectURL(await loadAsset(entry, onProgress));
}
