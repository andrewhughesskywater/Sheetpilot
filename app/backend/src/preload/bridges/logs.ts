import { ipcRenderer } from 'electron';

export const logsBridge = {
  getLogPath: (token: string): Promise<{ success: boolean; logPath?: string; logFiles?: string[]; error?: string }> =>
    ipcRenderer.invoke('logs:getLogPath', token),
  exportLogs: (
    token: string,
    logPath: string,
    format: 'json' | 'txt' = 'txt'
  ): Promise<{ success: boolean; content?: string; filename?: string; mimeType?: string; error?: string }> =>
    ipcRenderer.invoke('logs:exportLogs', token, logPath, format),
};
