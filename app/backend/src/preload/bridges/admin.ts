import { ipcRenderer } from 'electron';

export const adminBridge = {
  clearCredentials: (token: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('admin:clearCredentials', token),
  rebuildDatabase: (token: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('admin:rebuildDatabase', token)
};


