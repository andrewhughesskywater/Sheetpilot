/**
 * @fileoverview Window API Type Definitions
 * 
 * TypeScript definitions for Electron IPC APIs exposed via preload script.
 * All APIs are optional to support graceful degradation in development mode.
 * 
 * API Categories:
 * - api: General utilities (ping)
 * - timesheet: Draft and submission operations
 * - credentials: Secure credential storage
 * - auth: Authentication and session management
 * - admin: Administrative operations (destructive)
 * - database: Archive data access
 * - logs: Log file operations
 * - logger: Structured logging
 * - updates: Auto-update system
 * - settings: Application configuration
 */

export {};

declare global {
  interface Window {
    /**
     * General API utilities
     */
    api?: {
      /** Test IPC communication */
      ping: (msg: string) => Promise<string>;
    };
    
    /**
     * Timesheet draft and submission operations
     * 
     * Handles CRUD operations for draft entries and submission workflow.
     */
    timesheet?: {
      submit: (token: string, useMockWebsite?: boolean) => Promise<{
        submitResult?: { ok: boolean; successCount: number; removedCount: number; totalProcessed: number };
        dbPath?: string;
        error?: string;
      }>;
      cancel: () => Promise<{ success: boolean; message?: string; error?: string }>;
      devSimulateSuccess: () => Promise<{ success: boolean; count?: number; error?: string }>;
      saveDraft: (row: {
        id?: number;
        date?: string;
        timeIn?: string;
        timeOut?: string;
        project?: string;
        tool?: string | null;
        chargeCode?: string | null;
        taskDescription?: string;
      }) => Promise<{ 
        success: boolean; 
        changes?: number; 
        id?: number;
        entry?: {
          id: number;
          date: string;
          timeIn: string;
          timeOut: string;
          project: string;
          tool?: string | null;
          chargeCode?: string | null;
          taskDescription: string;
        };
        error?: string;
      }>;
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
      loadDraftById: (id: number) => Promise<{
        success: boolean;
        entry?: {
          id: number;
          date: string;
          timeIn: string;
          timeOut: string;
          project: string;
          tool?: string | null;
          chargeCode?: string | null;
          taskDescription: string;
        };
        error?: string;
      }>;
      deleteDraft: (id: number) => Promise<{ success: boolean; error?: string }>;
      resetInProgress: () => Promise<{ success: boolean; count?: number; error?: string }>;
      exportToCSV: () => Promise<{
        success: boolean;
        csvContent?: string;
        entryCount?: number;
        filename?: string;
        error?: string;
      }>;
      /** Subscribe to submission progress updates */
      onSubmissionProgress: (callback: (progress: { percent: number; current: number; total: number; message: string }) => void) => void;
      /** Unsubscribe from progress updates */
      removeProgressListener: () => void;
    };
    
    /**
     * Secure credential storage
     * 
     * Stores encrypted credentials in system keychain/credential store.
     * Passwords never stored in plain text.
     */
    credentials?: {
      /** Store credentials securely */
      store: (service: string, email: string, password: string) => Promise<{ success: boolean; message: string; changes: number }>;
      /** Retrieve credentials for a service */
      get: (service: string) => Promise<{ email: string; password: string } | null>;
      /** List all stored credential services */
      list: () => Promise<{ success: boolean; credentials: Array<{ id: number; service: string; email: string; created_at: string; updated_at: string }>; error?: string }>;
      /** Delete credentials for a service */
      delete: (service: string) => Promise<{ success: boolean; message: string; changes: number }>;
    };
    
    /**
     * Authentication and session management
     * 
     * Token-based authentication with session persistence.
     * Tokens validated on each use and expire after inactivity.
     */
    auth?: {
      /** Authenticate user and create session */
      login: (email: string, password: string, stayLoggedIn: boolean) => Promise<{ success: boolean; token?: string; isAdmin?: boolean; error?: string }>;
      /** Validate existing session token */
      validateSession: (token: string) => Promise<{ valid: boolean; email?: string; isAdmin?: boolean }>;
      /** End session and invalidate token */
      logout: (token: string) => Promise<{ success: boolean; error?: string }>;
      /** Get current session info */
      getCurrentSession: (token: string) => Promise<{ email: string; token: string; isAdmin: boolean } | null>;
    };
    
    /**
     * Administrative operations (destructive)
     * 
     * Requires admin token. All operations are irreversible.
     * Admin users cannot submit timesheets (read-only access).
     */
    admin?: {
      /** Delete all stored credentials (destructive) */
      clearCredentials: (token: string) => Promise<{ success: boolean; error?: string }>;
      /** Rebuild database from scratch (destructive - deletes all data) */
      rebuildDatabase: (token: string) => Promise<{ success: boolean; error?: string }>;
    };
    
    /**
     * Database archive access
     * 
     * Read-only access to submitted timesheet entries and credentials.
     * Requires authentication token.
     */
    database?: {
      /** Get all submitted timesheet entries */
      getAllTimesheetEntries: (token: string) => Promise<{
        success: boolean;
        entries?: Array<{
          id: number; date: string; time_in: number; time_out: number; hours: number;
          project: string; tool?: string; detail_charge_code?: string; task_description: string;
          status?: string; submitted_at?: string;
        }>;
        error?: string;
      }>;
      /** Get all stored credential records */
      getAllCredentials: () => Promise<{
        success: boolean;
        credentials?: Array<{ id: number; service: string; email: string; created_at: string; updated_at: string }>;
        error?: string;
      }>;
      /** Get all archive data in single batched call (timesheet + credentials) */
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
      /** Clear entire database (development only) */
      clearDatabase: () => Promise<{ success: boolean; error?: string }>;
    };
    
    /**
     * Log file operations
     * 
     * Access application logs for troubleshooting and support.
     */
    logs?: {
      /** Get log directory path and list of log files */
      getLogPath: () => Promise<{ success: boolean; logPath?: string; logFiles?: string[]; error?: string }>;
      /** Read and parse log file */
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
      /** Export logs for download */
      exportLogs: (logPath: string, format?: 'json' | 'txt') => Promise<{ success: boolean; content?: string; filename?: string; mimeType?: string; error?: string }>;
    };
    
    /**
     * Structured logging API
     * 
     * Logs written to file in NDJSON format with automatic PII redaction.
     */
    logger?: {
      /** Log error level message */
      error: (message: string, data?: unknown) => void;
      /** Log warning level message */
      warn: (message: string, data?: unknown) => void;
      /** Log info level message */
      info: (message: string, data?: unknown) => void;
      /** Log verbose level message */
      verbose: (message: string, data?: unknown) => void;
      /** Log debug level message */
      debug: (message: string, data?: unknown) => void;
      /** Log user action for analytics */
      userAction: (action: string, data?: unknown) => void;
    };
    
    /**
     * Auto-update system
     * 
     * Handles application updates with progress tracking.
     * Updates downloaded in background and installed on restart.
     */
    updates?: {
      /** Subscribe to update available events */
      onUpdateAvailable: (callback: (version: string) => void) => void;
      /** Subscribe to download progress updates */
      onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => void;
      /** Subscribe to update downloaded events */
      onUpdateDownloaded: (callback: (version: string) => void) => void;
      /** Cancel in-progress update download */
      cancelUpdate: () => void;
      /** Quit application and install update */
      quitAndInstall: () => void;
      /** Remove all update event listeners */
      removeAllListeners: () => void;
    };
    
    /**
     * Application settings
     * 
     * Persistent key-value storage for application configuration.
     */
    settings?: {
      /** Get setting value by key */
      get: (key: string) => Promise<{ success: boolean; value?: unknown; error?: string }>;
      /** Set setting value by key */
      set: (key: string, value: unknown) => Promise<{ success: boolean; error?: string }>;
      /** Get all settings */
      getAll: () => Promise<{ success: boolean; settings?: Record<string, unknown>; error?: string }>;
    };
  }
}
