// API fallback for development mode
// This provides mock implementations when Electron APIs are not available (e.g., in Vite dev server)

interface TimesheetRow {
  id?: number;
  date?: string;
  hours?: number;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
}

interface TimesheetEntry {
  id: number;
  date: string;
  hours: number | null;
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
    date: "10/25/2024",
    hours: 8.0,
    project: "SheetPilot Development",
    tool: "VS Code",
    chargeCode: "DEV-001",
    taskDescription: "Working on application features",
  },
  {
    id: 2,
    date: "10/24/2024",
    hours: 8.0,
    project: "Bug Fixes",
    tool: "Debugger",
    chargeCode: "BUG-002",
    taskDescription: "Fixed rendering issues",
  },
];

const mockArchiveData: TimesheetEntry[] = [
  {
    id: 1,
    date: "2024-10-25",
    hours: 8.0,
    project: "SheetPilot Development",
    tool: "VS Code",
    detail_charge_code: "DEV-001",
    task_description: "Working on application features",
    status: "Complete",
    submitted_at: "2024-10-25T17:00:00Z",
  },
];

const mockCredentials: Credential[] = [
  {
    id: 1,
    service: "smartsheet",
    email: "developer@company.com",
    created_at: "2024-10-25T10:00:00Z",
    updated_at: "2024-10-25T10:00:00Z",
  },
];

// Mock API implementations
const mockTimesheetAPI = {
  loadDraft: async (): Promise<{
    success: boolean;
    entries?: TimesheetRow[];
    error?: string;
  }> => {
    console.log("[MockAPI] Loading timesheet draft data");
    return {
      success: true,
      entries: mockTimesheetData,
    };
  },

  saveDraft: async (
    row: TimesheetRow & { id?: number }
  ): Promise<{ success: boolean; changes?: number; error?: string }> => {
    console.log("[MockAPI] Saving timesheet draft:", row);
    return {
      success: true,
      changes: 1,
    };
  },

  deleteDraft: async (
    id: number
  ): Promise<{ success: boolean; error?: string }> => {
    console.log("[MockAPI] Deleting timesheet draft:", id);
    return {
      success: true,
    };
  },

  submit: async (): Promise<{
    submitResult?: {
      ok: boolean;
      successCount: number;
      removedCount: number;
      totalProcessed: number;
    };
    dbPath?: string;
    error?: string;
  }> => {
    console.log("[MockAPI] Submitting timesheet");
    return {
      submitResult: {
        ok: true,
        successCount: 1,
        removedCount: 0,
        totalProcessed: 1,
      },
    };
  },

  exportToCSV: async (): Promise<{
    success: boolean;
    csvContent?: string;
    entryCount?: number;
    filename?: string;
    error?: string;
  }> => {
    console.log("[MockAPI] Exporting to CSV");
    return {
      success: true,
      csvContent: "Date,Hours,Project\n2024-10-25,8.00,SheetPilot Development",
      entryCount: 1,
      filename: "timesheet_export_2024-10-25.csv",
    };
  },
};

const mockCredentialsAPI = {
  store: async (
    service: string,
    email: string,
    _password: string
  ): Promise<{ success: boolean; message: string; changes: number }> => {
    console.log("[MockAPI] Storing credentials:", service, email);
    return {
      success: true,
      message: "Credentials stored successfully",
      changes: 1,
    };
  },

  list: async (): Promise<{
    success: boolean;
    credentials: Credential[];
    error?: string;
  }> => {
    console.log("[MockAPI] Listing credentials");
    return {
      success: true,
      credentials: mockCredentials,
    };
  },

  delete: async (
    service: string
  ): Promise<{ success: boolean; message: string; changes: number }> => {
    console.log("[MockAPI] Deleting credentials for:", service);
    return {
      success: true,
      message: "Credentials deleted successfully",
      changes: 1,
    };
  },
};

const mockDatabaseAPI = {
  getAllTimesheetEntries: async (
    token: string
  ): Promise<{
    success: boolean;
    entries?: TimesheetEntry[];
    error?: string;
  }> => {
    console.log("[MockAPI] Getting all timesheet entries");
    if (!token) {
      return {
        success: false,
        error: "Session token is required",
        entries: [],
      };
    }
    return {
      success: true,
      entries: mockArchiveData,
    };
  },

  getAllArchiveData: async (
    token: string
  ): Promise<{
    success: boolean;
    timesheet?: TimesheetEntry[];
    credentials?: Credential[];
    error?: string;
  }> => {
    console.log("[MockAPI] Getting all archive data");
    if (!token) {
      return {
        success: false,
        error: "Session token is required",
        timesheet: [],
        credentials: [],
      };
    }

    return {
      success: true,
      timesheet: mockArchiveData,
      credentials: mockCredentials,
    };
  },
};

const mockAuthAPI = {
  login: async (
    email: string,
    password: string,
    stayLoggedIn: boolean
  ): Promise<{
    success: boolean;
    token?: string;
    isAdmin?: boolean;
    error?: string;
  }> => {
    console.log("[MockAPI] Login attempt:", email, stayLoggedIn);
    // Mock admin login
    if (email === "Admin" && password === "admin123") {
      return {
        success: true,
        token: "mock-admin-token-" + Date.now(),
        isAdmin: true,
      };
    }
    // Mock regular user login
    if (email && password) {
      return {
        success: true,
        token: "mock-token-" + Date.now(),
        isAdmin: false,
      };
    }
    return {
      success: false,
      error: "Invalid credentials",
    };
  },

  validateSession: async (
    token: string
  ): Promise<{ valid: boolean; email?: string; isAdmin?: boolean }> => {
    console.log("[MockAPI] Validating session:", token);
    if (token?.startsWith("mock-")) {
      return {
        valid: true,
        email: "developer@company.com",
        isAdmin: token.includes("admin"),
      };
    }
    return {
      valid: false,
    };
  },

  logout: async (
    token: string
  ): Promise<{ success: boolean; error?: string }> => {
    console.log("[MockAPI] Logout:", token);
    return {
      success: true,
    };
  },

  getCurrentSession: async (
    token: string
  ): Promise<{ email: string; token: string; isAdmin: boolean } | null> => {
    console.log("[MockAPI] Getting current session:", token);
    if (token?.startsWith("mock-")) {
      return {
        email: "developer@company.com",
        token,
        isAdmin: token.includes("admin"),
      };
    }
    return null;
  },
};

const mockLogsAPI = {
  getLogPath: async (
    _token: string
  ): Promise<{
    success: boolean;
    logPath?: string;
    logFiles?: string[];
    error?: string;
  }> => {
    console.log("[MockAPI] Getting log path");
    return {
      success: true,
      logPath: "/mock/log/path/app.log",
      logFiles: ["app.log"],
    };
  },

  exportLogs: async (
    _token: string,
    logPath: string,
    format: "json" | "txt" = "txt"
  ): Promise<{
    success: boolean;
    content?: string;
    filename?: string;
    mimeType?: string;
    error?: string;
  }> => {
    console.log("[MockAPI] Exporting logs:", logPath, format);
    return {
      success: true,
      content:
        format === "json"
          ? '{"logs": []}'
          : "Application started\nDatabase initialized",
      filename: `logs_${new Date().toISOString().split("T")[0]}.${format}`,
      mimeType: format === "json" ? "application/json" : "text/plain",
    };
  },
};

const isDevEnvironment = (): boolean =>
  (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.DEV ===
    true ||
  (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.MODE ===
    "development";

const ensureFallback = (
  win: Record<string, unknown>,
  key: string,
  api: unknown,
  logMessage: string
): void => {
  if (win[key]) {
    return;
  }
  win[key] = api;
  console.log(logMessage);
};

// Export function to initialize API fallbacks
export function initializeAPIFallback(): void {
  // Check if we're in development mode and APIs are not available
  if (!isDevEnvironment()) {
    return;
  }

  console.log("[APIFallback] Initializing development API fallbacks");

  // Create fallback APIs if they don't exist
  const win = window as unknown as Record<string, unknown>;
  const fallbackEntries = [
    {
      key: "auth",
      api: mockAuthAPI,
      log: "[APIFallback] Mock auth API initialized",
    },
    {
      key: "timesheet",
      api: mockTimesheetAPI,
      log: "[APIFallback] Mock timesheet API initialized",
    },
    {
      key: "credentials",
      api: mockCredentialsAPI,
      log: "[APIFallback] Mock credentials API initialized",
    },
    {
      key: "database",
      api: mockDatabaseAPI,
      log: "[APIFallback] Mock database API initialized",
    },
    {
      key: "logs",
      api: mockLogsAPI,
      log: "[APIFallback] Mock logs API initialized",
    },
  ];

  fallbackEntries.forEach((entry) =>
    ensureFallback(win, entry.key, entry.api, entry.log)
  );

  console.log("[APIFallback] All development API fallbacks initialized");
}

// Export the mock APIs for direct use if needed
export {
  mockAuthAPI,
  mockTimesheetAPI,
  mockCredentialsAPI,
  mockDatabaseAPI,
  mockLogsAPI,
};
