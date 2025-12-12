import { ipcRenderer } from 'electron';

export const loggerBridge = {
  error: (message: string, data?: unknown): void => {
    ipcRenderer.send('logger:error', message, data);
  },
  warn: (message: string, data?: unknown): void => {
    ipcRenderer.send('logger:warn', message, data);
  },
  info: (message: string, data?: unknown): void => {
    ipcRenderer.send('logger:info', message, data);
  },
  verbose: (message: string, data?: unknown): void => {
    ipcRenderer.send('logger:verbose', message, data);
  },
  debug: (message: string, data?: unknown): void => {
    ipcRenderer.send('logger:debug', message, data);
  },
  userAction: (action: string, data?: unknown): void => {
    ipcRenderer.send('logger:user-action', action, data);
  }
};


