import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
    ping: (msg: string): Promise<string> => ipcRenderer.invoke('ping', msg)
});

contextBridge.exposeInMainWorld('timesheet', {
  submit: (token: string): Promise<{
    submitResult?: { ok: boolean; successCount: number; removedCount: number; totalProcessed: number };
    dbPath?: string; 
    error?: string;
  }> => ipcRenderer.invoke('timesheet:submit', token),
  saveDraft: (row: {
    date: string;
    timeIn: string;
    timeOut: string;
    project: string;
    tool?: string | null;
    chargeCode?: string | null;
    taskDescription: string;
  }): Promise<{ success: boolean; changes?: number; error?: string }> => 
    ipcRenderer.invoke('timesheet:saveDraft', row),
  loadDraft: (): Promise<{
    success: boolean;
    entries?: Array<{
      id?: number;
      date: string;
      timeIn: string;
      timeOut: string;
      project: string;
      tool?: string | null;
      chargeCode?: string | null;
      taskDescription: string;
    }>;
    error?: string;
  }> => ipcRenderer.invoke('timesheet:loadDraft'),
  deleteDraft: (id: number): Promise<{ success: boolean; error?: string }> => 
    ipcRenderer.invoke('timesheet:deleteDraft', id),
  exportToCSV: (): Promise<{
    success: boolean;
    csvContent?: string;
    entryCount?: number;
    filename?: string;
    error?: string;
  }> => ipcRenderer.invoke('timesheet:exportToCSV')
});


contextBridge.exposeInMainWorld('credentials', {
  store: (service: string, email: string, password: string): Promise<{
    success: boolean; message: string; changes: number;
  }> => ipcRenderer.invoke('credentials:store', service, email, password),
  get: (service: string): Promise<{ email: string; password: string } | null> => 
    ipcRenderer.invoke('credentials:get', service),
  list: (): Promise<{
    success: boolean; credentials: Array<{
      id: number; service: string; email: string; created_at: string; updated_at: string;
    }>; error?: string;
  }> => ipcRenderer.invoke('credentials:list'),
  delete: (service: string): Promise<{
    success: boolean; message: string; changes: number;
  }> => ipcRenderer.invoke('credentials:delete', service)
});

contextBridge.exposeInMainWorld('auth', {
  login: (email: string, password: string, stayLoggedIn: boolean): Promise<{
    success: boolean;
    token?: string;
    isAdmin?: boolean;
    error?: string;
  }> => ipcRenderer.invoke('auth:login', email, password, stayLoggedIn),
  validateSession: (token: string): Promise<{
    valid: boolean;
    email?: string;
    isAdmin?: boolean;
  }> => ipcRenderer.invoke('auth:validateSession', token),
  logout: (token: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('auth:logout', token),
  getCurrentSession: (token: string): Promise<{
    email: string;
    token: string;
    isAdmin: boolean;
  } | null> => ipcRenderer.invoke('auth:getCurrentSession', token)
});

contextBridge.exposeInMainWorld('admin', {
  clearCredentials: (token: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('admin:clearCredentials', token),
  rebuildDatabase: (token: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('admin:rebuildDatabase', token)
});

contextBridge.exposeInMainWorld('database', {
  getAllTimesheetEntries: (token: string): Promise<{
    success: boolean;
    entries?: Array<{
      id: number; date: string; time_in: number; time_out: number; hours: number;
      project: string; tool?: string; detail_charge_code?: string; task_description: string;
      status?: string; submitted_at?: string;
    }>;
    error?: string;
  }> => ipcRenderer.invoke('database:getAllTimesheetEntries', token),
  getAllCredentials: (): Promise<Array<{
    id: number; service: string; email: string; created_at: string; updated_at: string;
  }>> => ipcRenderer.invoke('database:getAllCredentials'),
  clearDatabase: (): Promise<{ success: boolean; error?: string }> => 
    ipcRenderer.invoke('database:clearDatabase')
});

contextBridge.exposeInMainWorld('logs', {
  getLogPath: (): Promise<{
    success: boolean;
    logPath?: string;
    logFiles?: string[];
    error?: string;
  }> => ipcRenderer.invoke('logs:getLogPath'),
  readLogFile: (logPath: string): Promise<{
    success: boolean;
    logs?: Array<{
      lineNumber: number;
      timestamp?: string;
      level?: string;
      message?: string;
      component?: string;
      sessionId?: string;
      username?: string;
      application?: string;
      version?: string;
      environment?: string;
      process?: {
        pid: number;
        platform: string;
        nodeVersion: string;
      };
      data?: unknown;
      raw?: string;
    }>;
    totalLines?: number;
    error?: string;
  }> => ipcRenderer.invoke('logs:readLogFile', logPath),
  exportLogs: (logPath: string, format: 'json' | 'txt' = 'txt'): Promise<{
    success: boolean;
    content?: string;
    filename?: string;
    mimeType?: string;
    error?: string;
  }> => ipcRenderer.invoke('logs:exportLogs', logPath, format)
});

// Renderer-to-main logging bridge
contextBridge.exposeInMainWorld('logger', {
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
  // User interaction tracking
  userAction: (action: string, data?: unknown): void => {
    ipcRenderer.send('logger:user-action', action, data);
  }
});

// Update events IPC bridge
contextBridge.exposeInMainWorld('updates', {
  // Listen for update available
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on('update-available', (_event, version) => callback(version));
  },
  // Listen for download progress
  onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => {
    ipcRenderer.on('download-progress', (_event, progress) => callback(progress));
  },
  // Listen for update downloaded
  onUpdateDownloaded: (callback: (version: string) => void) => {
    ipcRenderer.on('update-downloaded', (_event, version) => callback(version));
  },
  // Cancel update
  cancelUpdate: (): void => {
    ipcRenderer.send('cancel-update');
  },
  // Quit and install
  quitAndInstall: (): void => {
    ipcRenderer.send('quit-and-install');
  },
  // Remove all listeners
  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
  }
});