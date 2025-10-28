// API fallback for development mode
// This provides mock implementations when Electron APIs are not available (e.g., in Vite dev server)

interface TimesheetRow {
  id?: number;
  date: string;
  timeIn: string;
  timeOut: string;
  project: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription: string;
}

interface TimesheetEntry {
  id: number;
  date: string;
  time_in: number;
  time_out: number;
  hours: number;
  project: string;
  tool?: string;
  detail_charge_code?: string;
  task_description: string;
  status?: string;
  submitted_at?: string;
}

interface Credential {
  id: number;
  service: string;
  email: string;
  created_at: string;
  updated_at: string;
}

// Mock data for development
const mockTimesheetData: TimesheetRow[] = [
  {
    id: 1,
    date: '2024-10-25',
    timeIn: '09:00',
    timeOut: '17:00',
    project: 'SheetPilot Development',
    tool: 'VS Code',
    chargeCode: 'DEV-001',
    taskDescription: 'Working on application features'
  },
  {
    id: 2,
    date: '2024-10-24',
    timeIn: '08:30',
    timeOut: '16:30',
    project: 'Bug Fixes',
    tool: 'Debugger',
    chargeCode: 'BUG-002',
    taskDescription: 'Fixed rendering issues'
  }
];

const mockArchiveData: TimesheetEntry[] = [
  {
    id: 1,
    date: '2024-10-25',
    time_in: 540, // 9:00 AM
    time_out: 1020, // 5:00 PM
    hours: 8,
    project: 'SheetPilot Development',
    tool: 'VS Code',
    detail_charge_code: 'DEV-001',
    task_description: 'Working on application features',
    status: 'Complete',
    submitted_at: '2024-10-25T17:00:00Z'
  }
];

const mockCredentials: Credential[] = [
  {
    id: 1,
    service: 'smartsheet',
    email: 'developer@company.com',
    created_at: '2024-10-25T10:00:00Z',
    updated_at: '2024-10-25T10:00:00Z'
  }
];

// Mock API implementations
const mockTimesheetAPI = {
  loadDraft: async (): Promise<{ success: boolean; entries?: TimesheetRow[]; error?: string }> => {
    console.log('[MockAPI] Loading timesheet draft data');
    return {
      success: true,
      entries: mockTimesheetData
    };
  },

  saveDraft: async (row: TimesheetRow & { id?: number }): Promise<{ success: boolean; changes?: number; error?: string }> => {
    console.log('[MockAPI] Saving timesheet draft:', row);
    return {
      success: true,
      changes: 1
    };
  },

  deleteDraft: async (id: number): Promise<{ success: boolean; error?: string }> => {
    console.log('[MockAPI] Deleting timesheet draft:', id);
    return {
      success: true
    };
  },

  submit: async (): Promise<{ submitResult?: { ok: boolean; successCount: number; removedCount: number; totalProcessed: number }; dbPath?: string; error?: string }> => {
    console.log('[MockAPI] Submitting timesheet');
    return {
      submitResult: {
        ok: true,
        successCount: 1,
        removedCount: 0,
        totalProcessed: 1
      }
    };
  },

  exportToCSV: async (): Promise<{ success: boolean; csvContent?: string; entryCount?: number; filename?: string; error?: string }> => {
    console.log('[MockAPI] Exporting to CSV');
    return {
      success: true,
      csvContent: 'Date,Start Time,End Time,Hours,Project\n2024-10-25,09:00,17:00,8,SheetPilot Development',
      entryCount: 1,
      filename: 'timesheet_export_2024-10-25.csv'
    };
  }
};

const mockCredentialsAPI = {
  store: async (service: string, email: string, _password: string): Promise<{ success: boolean; message: string; changes: number }> => {
    console.log('[MockAPI] Storing credentials:', service, email);
    return {
      success: true,
      message: 'Credentials stored successfully',
      changes: 1
    };
  },

  get: async (service: string): Promise<{ email: string; password: string } | null> => {
    console.log('[MockAPI] Getting credentials for:', service);
    const cred = mockCredentials.find(c => c.service === service);
    return cred ? { email: cred.email, password: '***' } : null;
  },

  list: async (): Promise<{ success: boolean; credentials: Credential[]; error?: string }> => {
    console.log('[MockAPI] Listing credentials');
    return {
      success: true,
      credentials: mockCredentials
    };
  },

  delete: async (service: string): Promise<{ success: boolean; message: string; changes: number }> => {
    console.log('[MockAPI] Deleting credentials for:', service);
    return {
      success: true,
      message: 'Credentials deleted successfully',
      changes: 1
    };
  }
};

const mockDatabaseAPI = {
  getAllTimesheetEntries: async (): Promise<{ success: boolean; entries?: TimesheetEntry[]; error?: string }> => {
    console.log('[MockAPI] Getting all timesheet entries');
    return {
      success: true,
      entries: mockArchiveData
    };
  },

  getAllCredentials: async (): Promise<{ success: boolean; credentials?: Credential[]; error?: string }> => {
    console.log('[MockAPI] Getting all credentials');
    return {
      success: true,
      credentials: mockCredentials
    };
  },

  clearDatabase: async (): Promise<{ success: boolean; error?: string }> => {
    console.log('[MockAPI] Clearing database');
    return {
      success: true
    };
  }
};

const mockLogsAPI = {
  getLogPath: async (): Promise<{ success: boolean; logPath?: string; logFiles?: string[]; error?: string }> => {
    console.log('[MockAPI] Getting log path');
    return {
      success: true,
      logPath: '/mock/log/path/app.log',
      logFiles: ['app.log']
    };
  },

  readLogFile: async (logPath: string): Promise<{ success: boolean; logs?: Array<{ lineNumber: number; timestamp?: string; level?: string; message?: string; component?: string; sessionId?: string; username?: string; application?: string; version?: string; environment?: string; process?: { pid: number; platform: string; nodeVersion: string; }; data?: unknown; raw?: string; }>; totalLines?: number; error?: string }> => {
    console.log('[MockAPI] Reading log file:', logPath);
    return {
      success: true,
      logs: [
        { lineNumber: 1, timestamp: '2024-10-25T10:00:00Z', level: 'info', message: 'Application started' },
        { lineNumber: 2, timestamp: '2024-10-25T10:01:00Z', level: 'debug', message: 'Database initialized' }
      ],
      totalLines: 2
    };
  },

  exportLogs: async (logPath: string, format: 'json' | 'txt' = 'txt'): Promise<{ success: boolean; content?: string; filename?: string; mimeType?: string; error?: string }> => {
    console.log('[MockAPI] Exporting logs:', logPath, format);
    return {
      success: true,
      content: format === 'json' ? '{"logs": []}' : 'Application started\nDatabase initialized',
      filename: `logs_${new Date().toISOString().split('T')[0]}.${format}`,
      mimeType: format === 'json' ? 'application/json' : 'text/plain'
    };
  }
};

// Export function to initialize API fallbacks
export function initializeAPIFallback(): void {
  // Check if we're in development mode and APIs are not available
  const isDev = (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.DEV === true || 
                (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.MODE === 'development';
  
  if (isDev) {
    console.log('[APIFallback] Initializing development API fallbacks');
    
    // Create fallback APIs if they don't exist
    if (!window.timesheet) {
      window.timesheet = mockTimesheetAPI;
      console.log('[APIFallback] Mock timesheet API initialized');
    }
    
    if (!window.credentials) {
      window.credentials = mockCredentialsAPI;
      console.log('[APIFallback] Mock credentials API initialized');
    }
    
    if (!window.database) {
      window.database = mockDatabaseAPI;
      console.log('[APIFallback] Mock database API initialized');
    }
    
    if (!window.logs) {
      window.logs = mockLogsAPI;
      console.log('[APIFallback] Mock logs API initialized');
    }
    
    console.log('[APIFallback] All development API fallbacks initialized');
  }
}

// Export the mock APIs for direct use if needed
export { mockTimesheetAPI, mockCredentialsAPI, mockDatabaseAPI, mockLogsAPI };
