export function onUpdateAvailable(callback: (version: string) => void): void {
  window.updates?.onUpdateAvailable?.(callback);
}

export function onDownloadProgress(callback: (progress: { percent: number; transferred: number; total: number }) => void): void {
  window.updates?.onDownloadProgress?.(callback);
}

export function onUpdateDownloaded(callback: (version: string) => void): void {
  window.updates?.onUpdateDownloaded?.(callback);
}

export function removeAllUpdateListeners(): void {
  window.updates?.removeAllListeners?.();
}


