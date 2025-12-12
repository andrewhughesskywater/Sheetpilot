import { ipcRenderer } from 'electron';

export const settingsBridge = {
  get: (key: string): Promise<{ success: boolean; value?: unknown; error?: string }> => ipcRenderer.invoke('settings:get', key),
  set: (key: string, value: unknown): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('settings:set', key, value),
  getAll: (): Promise<{ success: boolean; settings?: Record<string, unknown>; error?: string }> => ipcRenderer.invoke('settings:getAll')
};


