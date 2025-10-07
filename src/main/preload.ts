import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
    ping: (msg: string): Promise<string> => ipcRenderer.invoke('ping', msg)
});

contextBridge.exposeInMainWorld('timesheet', {
  submit: (): Promise<{
    submitResult?: { ok: boolean; successCount: number; removedCount: number; totalProcessed: number };
    dbPath?: string; 
    error?: string;
  }> => ipcRenderer.invoke('timesheet:submit'),
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
  loadDraft: (): Promise<Array<{
    date: string;
    timeIn: string;
    timeOut: string;
    project: string;
    tool?: string | null;
    chargeCode?: string | null;
    taskDescription: string;
  }>> => ipcRenderer.invoke('timesheet:loadDraft'),
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

contextBridge.exposeInMainWorld('database', {
  getAllTimesheetEntries: (): Promise<Array<{
    id: number; date: string; time_in: number; time_out: number; hours: number;
    project: string; tool?: string; detail_charge_code?: string; task_description: string;
    status?: string; submitted_at?: string;
  }>> => ipcRenderer.invoke('database:getAllTimesheetEntries'),
  getAllCredentials: (): Promise<Array<{
    id: number; service: string; email: string; created_at: string; updated_at: string;
  }>> => ipcRenderer.invoke('database:getAllCredentials'),
  clearDatabase: (): Promise<{ success: boolean; error?: string }> => 
    ipcRenderer.invoke('database:clearDatabase')
});