import { ipcRenderer } from 'electron';

export const timesheetBridge = {
  submit: (
    token: string,
    useMockWebsite?: boolean
  ): Promise<{
    submitResult?: { ok: boolean; successCount: number; removedCount: number; totalProcessed: number };
    dbPath?: string;
    error?: string;
  }> => ipcRenderer.invoke('timesheet:submit', token, useMockWebsite),
  cancel: (): Promise<{ success: boolean; message?: string; error?: string }> => ipcRenderer.invoke('timesheet:cancel'),
  devSimulateSuccess: (): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('timesheet:devSimulateSuccess'),
  saveDraft: (row: {
    id?: number;
    date?: string;
    hours?: number;
    project?: string;
    tool?: string | null;
    chargeCode?: string | null;
    taskDescription?: string;
  }): Promise<{
    success: boolean;
    changes?: number;
    id?: number;
    entry?: {
      id: number;
      date: string;
      hours: number;
      project: string;
      tool?: string | null;
      chargeCode?: string | null;
      taskDescription: string;
    };
    error?: string;
  }> => ipcRenderer.invoke('timesheet:saveDraft', row),
  loadDraft: (): Promise<{
    success: boolean;
    entries?: Array<{
      id?: number;
      date?: string;
      hours?: number;
      project?: string;
      tool?: string | null;
      chargeCode?: string | null;
      taskDescription?: string;
    }>;
    error?: string;
  }> => ipcRenderer.invoke('timesheet:loadDraft'),
  loadDraftById: (
    id: number
  ): Promise<{
    success: boolean;
    entry?: {
      id: number;
      date: string;
      hours: number;
      project: string;
      tool?: string | null;
      chargeCode?: string | null;
      taskDescription: string;
    };
    error?: string;
  }> => ipcRenderer.invoke('timesheet:loadDraftById', id),
  deleteDraft: (id: number): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('timesheet:deleteDraft', id),
  resetInProgress: (): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('timesheet:resetInProgress'),
  exportToCSV: (): Promise<{
    success: boolean;
    csvContent?: string;
    entryCount?: number;
    filename?: string;
    error?: string;
  }> => ipcRenderer.invoke('timesheet:exportToCSV'),
  onSubmissionProgress: (
    callback: (progress: { percent: number; current: number; total: number; message: string }) => void
  ) => {
    ipcRenderer.removeAllListeners('timesheet:progress');
    ipcRenderer.on('timesheet:progress', (_event, progress) => callback(progress));
  },
  removeProgressListener: (): void => {
    ipcRenderer.removeAllListeners('timesheet:progress');
  }
};


