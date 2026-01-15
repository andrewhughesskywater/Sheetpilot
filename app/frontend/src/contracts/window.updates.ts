/**
 * @fileoverview Window API - Auto-update system
 */

export {};

declare global {
  interface Window {
    /**
     * Auto-update system
     *
     * Handles application updates with progress tracking.
     * Updates downloaded in background and installed on restart.
     */
    updates?: {
      /** Subscribe to update available events */
      onUpdateAvailable: (callback: (version: string) => void) => void;
      /** Subscribe to download progress updates */
      onDownloadProgress: (
        callback: (progress: {
          percent: number;
          transferred: number;
          total: number;
        }) => void
      ) => void;
      /** Subscribe to update downloaded events */
      onUpdateDownloaded: (callback: (version: string) => void) => void;
      /** Cancel in-progress update download */
      cancelUpdate: () => void;
      /** Quit application and install update */
      quitAndInstall: () => void;
      /** Remove all update event listeners */
      removeAllListeners: () => void;
    };
  }
}
