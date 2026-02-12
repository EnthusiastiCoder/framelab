/** The minimal Storage subset the gate needs (localStorage satisfies it). */
export interface GateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const GATE_STORAGE_KEY = 'framelab.models.download-ok';

export interface DownloadGate {
  /** True once the user confirmed a model download, this session or remembered. */
  allowed(): boolean;
  /** Records the user's confirmation; `remember` persists it in storage. */
  confirm(remember: boolean): void;
  /** Clears both the session and the remembered confirmation. */
  forget(): void;
}

/** No confirmation, no download. "Remember my choice" persists the confirmation in storage. */
export function createDownloadGate(storage: GateStorage | null): DownloadGate {
  let session = false;
  const remembered = () => {
    try {
      return storage?.getItem(GATE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  };
  return {
    allowed: () => session || remembered(),
    confirm(remember) {
      session = true;
      if (remember) {
        try {
          storage?.setItem(GATE_STORAGE_KEY, '1');
        } catch {
          /* storage unavailable: the session confirmation still holds */
        }
      }
    },
    forget() {
      session = false;
      try {
        storage?.removeItem(GATE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}

/** Bytes still to download: 0 when the model is already cached in this browser. */
export function bytesToDownload(model: { bytes: number }, cached: boolean): number {
  return cached ? 0 : model.bytes;
}

/** Formats bytes as whole megabytes (decimal MB, as the model labels use). */
export function formatMB(bytes: number): string {
  return `${Math.round(bytes / 1e6)} MB`;
}

/** The size notice shown before a model download. */
export function noticeText(model: { label: string; bytes: number }, cached: boolean): string {
  const size = formatMB(bytesToDownload(model, cached));
  const what = cached
    ? `This speech model is already saved in this browser, so it needs ${size} to download.`
    : `Generating subtitles needs a one-time download of this speech model: ${size} from this site.`;
  return `${what} It runs entirely in your browser: your audio never leaves this device. You can delete downloaded models at any time on the privacy page.`;
}
