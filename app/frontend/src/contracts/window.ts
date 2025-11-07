export {};

declare global {
  interface Window {
    api?: {
      ping: (msg: string) => Promise<string>;
    };
    timesheet?: {
      submit: (token: string) => Promise<{
        submitResult?: { ok: boolean; successCount: number; removedCount: number; totalProcessed: number };
        dbPath?: string;
        error?: string;
      }>;
      saveDraft: (row: {
        date: string;
        timeIn: string;
        timeOut: string;
        project: string;
        tool?: string | null;
        chargeCode?: string | null;
        taskDescription: string;
      }) => Promise<{ success: boolean; changes?: number; error?: string }>;
      loadDraft: () => Promise<{
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
      }>;
      deleteDraft: (id: number) => Promise<{ success: boolean; error?: string }>;
      exportToCSV: () => Promise<{
        success: boolean;
        csvContent?: string;
        entryCount?: number;
        filename?: string;
        error?: string;
      }>;
      onSubmissionProgress: (callback: (progress: { percent: number; current: number; total: number; message: string }) => void) => void;
      removeProgressListener: () => void;
    };
    credentials?: {
      store: (service: string, email: string, password: string) => Promise<{ success: boolean; message: string; changes: number }>;
      get: (service: string) => Promise<{ email: string; password: string } | null>;
      list: () => Promise<{ success: boolean; credentials: Array<{ id: number; service: string; email: string; created_at: string; updated_at: string }>; error?: string }>;
      delete: (service: string) => Promise<{ success: boolean; message: string; changes: number }>;
    };
    auth?: {
      login: (email: string, password: string, stayLoggedIn: boolean) => Promise<{ success: boolean; token?: string; isAdmin?: boolean; error?: string }>;
      validateSession: (token: string) => Promise<{ valid: boolean; email?: string; isAdmin?: boolean }>;
      logout: (token: string) => Promise<{ success: boolean; error?: string }>;
      getCurrentSession: (token: string) => Promise<{ email: string; token: string; isAdmin: boolean } | null>;
    };
    admin?: {
      clearCredentials: (token: string) => Promise<{ success: boolean; error?: string }>;
      rebuildDatabase: (token: string) => Promise<{ success: boolean; error?: string }>;
    };
    database?: {
      getAllTimesheetEntries: (token: string) => Promise<{
        success: boolean;
        entries?: Array<{
          id: number; date: string; time_in: number; time_out: number; hours: number;
          project: string; tool?: string; detail_charge_code?: string; task_description: string;
          status?: string; submitted_at?: string;
        }>;
        error?: string;
      }>;
      getAllCredentials: () => Promise<{
        success: boolean;
        credentials?: Array<{ id: number; service: string; email: string; created_at: string; updated_at: string }>;
        error?: string;
      }>;
      getAllArchiveData: (token: string) => Promise<{
        success: boolean;
        timesheet?: Array<{
          id: number; date: string; time_in: number; time_out: number; hours: number;
          project: string; tool?: string; detail_charge_code?: string; task_description: string;
          status?: string; submitted_at?: string;
        }>;
        credentials?: Array<{ id: number; service: string; email: string; created_at: string; updated_at: string }>;
        error?: string;
      }>;
      clearDatabase: () => Promise<{ success: boolean; error?: string }>;
    };
    logs?: {
      getLogPath: () => Promise<{ success: boolean; logPath?: string; logFiles?: string[]; error?: string }>;
      readLogFile: (logPath: string) => Promise<{
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
          process?: { pid: number; platform: string; nodeVersion: string };
          data?: unknown;
          raw?: string;
        }>;
        totalLines?: number;
        error?: string;
      }>;
      exportLogs: (logPath: string, format?: 'json' | 'txt') => Promise<{ success: boolean; content?: string; filename?: string; mimeType?: string; error?: string }>;
    };
    logger?: {
      error: (message: string, data?: unknown) => void;
      warn: (message: string, data?: unknown) => void;
      info: (message: string, data?: unknown) => void;
      verbose: (message: string, data?: unknown) => void;
      debug: (message: string, data?: unknown) => void;
      userAction: (action: string, data?: unknown) => void;
    };
    updates?: {
      onUpdateAvailable: (callback: (version: string) => void) => void;
      onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => void;
      onUpdateDownloaded: (callback: (version: string) => void) => void;
      cancelUpdate: () => void;
      quitAndInstall: () => void;
      removeAllListeners: () => void;
    };
  }
}
