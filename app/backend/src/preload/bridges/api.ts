import { ipcRenderer } from 'electron';

export const apiBridge = {
  ping: (msg: string): Promise<string> => ipcRenderer.invoke('ping', msg)
};


