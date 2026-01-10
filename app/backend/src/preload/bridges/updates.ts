import { ipcRenderer } from 'electron';

export const updatesBridge = {
  onUpdateAvailable: (callback: (version: string) => void): void => {
    ipcRenderer.on('update-available', (_event, version) => callback(version));
  },
  onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void): void => {
    ipcRenderer.on('download-progress', (_event, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback: (version: string) => void): void => {
    ipcRenderer.on('update-downloaded', (_event, version) => callback(version));
  },
  cancelUpdate: (): void => {
    ipcRenderer.send('cancel-update');
  },
  quitAndInstall: (): void => {
    ipcRenderer.send('quit-and-install');
  },
  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
  },
};
