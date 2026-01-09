/**
 * @fileoverview Data Context Provider
 * 
 * Centralized data management for timesheet draft and archive data.
 * Provides loading states, error handling, and refresh capabilities for all data consumers.
 * 
 * Architecture decisions:
 * - Delays data loading until user navigates to tabs (on-demand loading) to prevent
 *   blocking startup and violating long task performance budgets
 * - Uses yielding strategy (setTimeout 0) for large datasets to maintain UI responsiveness
 * - Batches archive API calls (timesheet + credentials) to reduce IPC overhead
 * - Requires authentication token for archive data access (security boundary)
 * 
 * Performance considerations:
 * - Startup loading intentionally skipped to meet performance targets
 * - Large dataset processing (>100 rows) yields control to prevent UI blocking
 * - All async operations properly handle cleanup to prevent memory leaks
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useSession } from './SessionContext';
import { loadDraft } from '@/services/ipc/timesheet';
import { getAllArchiveData } from '@/services/ipc/database';
import { logError, logInfo, logVerbose, logWarn, logDebug } from '@/services/ipc/logger';

// Define data types

/**
 * Timesheet row data structure for draft entries
 * 
 * Represents a single time entry in the editable timesheet grid.
 * Fields are optional to support partial data entry.
 */
interface TimesheetRow {
  /** Database ID (present after first save) */
  id?: number;
  /** Date in MM/DD/YYYY format */
  date?: string;
  /** Start time in HH:MM format (24-hour) */
  timeIn?: string;
  /** End time in HH:MM format (24-hour) */
  timeOut?: string;
  /** Project name from business config */
  project?: string;
  /** Tool name (null if project doesn't require tools) */
  tool?: string | null;
  /** Charge code (null if tool doesn't require charge code) */
  chargeCode?: string | null;
  /** Task description text (max 120 chars) */
  taskDescription?: string;
}

/**
 * Submitted timesheet entry from archive
 * 
 * Represents a completed and submitted time entry.
 * Uses numeric time format (minutes since midnight) for database storage.
 */
interface TimesheetEntry {
  /** Database ID */
  id: number;
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Start time as minutes since midnight (e.g., 540 = 9:00 AM) */
  time_in: number;
  /** End time as minutes since midnight */
  time_out: number;
  /** Calculated hours (decimal) */
  hours: number;
  /** Project name */
  project: string;
  /** Tool name (if applicable) */
  tool?: string;
  /** Charge code (if applicable) */
  detail_charge_code?: string;
  /** Task description */
  task_description: string;
  /** Submission status (pending, in_progress, submitted) */
  status?: string;
  /** ISO timestamp of submission */
  submitted_at?: string;
}

/**
 * Stored credential record
 */
interface Credential {
  /** Database ID */
  id: number;
  /** Service name (e.g., "smartsheet") */
  service: string;
  /** User's email address */
  email: string;
  /** ISO timestamp of creation */
  created_at: string;
  /** ISO timestamp of last update */
  updated_at: string;
}

/**
 * Combined archive data structure
 */
interface DatabaseData {
  /** All submitted timesheet entries */
  timesheet: TimesheetEntry[];
  /** All stored credentials */
  credentials: Credential[];
}

/**
 * Data context interface
 * 
 * Provides centralized data access for timesheet and archive views.
 * All data fetching, loading states, and refresh logic managed here.
 */
interface DataContextType {
  // Timesheet draft data
  timesheetDraftData: TimesheetRow[];
  setTimesheetDraftData: (data: TimesheetRow[]) => void;
  refreshTimesheetDraft: () => Promise<void>;
  
  // Archive data
  archiveData: DatabaseData;
  setArchiveData: (data: DatabaseData) => void;
  refreshArchiveData: () => Promise<void>;
  
  // Loading states
  isTimesheetDraftLoading: boolean;
  isArchiveDataLoading: boolean;
  
  // Error states
  timesheetDraftError: string | null;
  archiveDataError: string | null;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

function useInitializeDataContext(
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  setArchiveData: (data: DatabaseData) => void,
  setIsTimesheetDraftLoading: (loading: boolean) => void,
  setIsArchiveDataLoading: (loading: boolean) => void
) {
  useEffect(() => {
    logInfo('[DataContext] Skipping startup data loading to prevent performance violations');
    setTimesheetDraftData([{}]);
    setArchiveData({ timesheet: [], credentials: [] });
    setIsTimesheetDraftLoading(false);
    setIsArchiveDataLoading(false);
  }, [setTimesheetDraftData, setArchiveData, setIsTimesheetDraftLoading, setIsArchiveDataLoading]);
}

export function DataProvider({ children }: DataProviderProps) {
  // Get session token for authenticated API calls
  const { token } = useSession();
  
  // Timesheet draft data state
  const [timesheetDraftData, setTimesheetDraftData] = useState<TimesheetRow[]>([{}]);
  const [isTimesheetDraftLoading, setIsTimesheetDraftLoading] = useState(true);
  const [timesheetDraftError, setTimesheetDraftError] = useState<string | null>(null);
  
  // Archive data state
  const [archiveData, setArchiveData] = useState<DatabaseData>({ timesheet: [], credentials: [] });
  const [isArchiveDataLoading, setIsArchiveDataLoading] = useState(true);
  const [archiveDataError, setArchiveDataError] = useState<string | null>(null);


  /**
   * Yields control back to browser to prevent blocking main thread
   * 
   * Uses setTimeout(0) to break up long tasks and maintain UI responsiveness.
   * Critical for meeting performance budgets during data processing.
   * 
   * @returns Promise that resolves after yielding
   */
  const yieldToMain = useCallback(() => {
    return new Promise(resolve => {
      setTimeout(resolve, 0);
    });
  }, []);

  const prepareRowsWithBlank = useCallback((draftData: TimesheetRow[]): TimesheetRow[] => {
    if (draftData.length > 0 && Object.keys(draftData[0] || {}).length > 0) {
      return [...draftData, {}];
    }
    return [{}];
  }, []);

  const handleDraftLoadSuccess = useCallback((response: { success: boolean; entries?: TimesheetRow[]; error?: string }) => {
    if (response && response.success) {
      const draftData = response.entries || [];
      setTimesheetDraftData(prepareRowsWithBlank(draftData));
    } else {
      const errorMsg = response?.error || 'Could not load timesheet draft';
      setTimesheetDraftError(errorMsg);
      setTimesheetDraftData([{}]);
    }
  }, [prepareRowsWithBlank, setTimesheetDraftData, setTimesheetDraftError]);

  const handleDraftLoadError = useCallback((error: unknown) => {
    logError('Error loading timesheet draft data', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    setTimesheetDraftError(error instanceof Error ? error.message : 'Could not load timesheet draft');
    setTimesheetDraftData([{}]);
  }, [setTimesheetDraftError, setTimesheetDraftData]);

  /**
   * Load timesheet draft data from database
   * 
   * Fetches pending timesheet entries and prepares them for editing.
   * Implements yielding strategy to prevent blocking UI thread.
   */
  const loadTimesheetDraftData = useCallback(async () => {
    try {
      logDebug('[DataContext] Setting loading true for timesheet draft');
      setIsTimesheetDraftLoading(true);
      setTimesheetDraftError(null);
      
      logVerbose('[DataContext] Loading timesheet draft data...');
      await yieldToMain();
      
      const response = await loadDraft();
      await yieldToMain();
      
      logVerbose('[DataContext] Loaded timesheet draft response', response);
      handleDraftLoadSuccess(response);
    } catch (error) {
      handleDraftLoadError(error);
    } finally {
      logDebug('[DataContext] Setting loading false for timesheet draft');
      setIsTimesheetDraftLoading(false);
    }
  }, [yieldToMain, handleDraftLoadSuccess, handleDraftLoadError]);

  /**
   * Load archive data (submitted timesheet entries and credentials)
   * 
   * Fetches historical timesheet data and stored credentials for archive view.
   * Requires authentication token for security. Implements yielding for large datasets.
   * 
   * Data flow:
   * 1. Validate token exists (security boundary)
   * 2. Set loading state
   * 3. Yield to main thread
   * 4. Fetch batched archive data (timesheet + credentials in one IPC call)
   * 5. Yield after IPC call
   * 6. Yield again if dataset > 100 rows (performance optimization)
   * 7. Update state with parsed data
   * 
   * Performance optimization:
   * - Batches API calls to reduce IPC overhead
   * - Yields for large datasets (>100 rows) to prevent UI freeze
   * - Uses token dependency to trigger refresh on auth changes
   * 
   * @throws Sets error state if token missing or fetch fails
   */
  const handleArchiveLoadError = useCallback((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError('[DataContext] Could not load archive data', error);
    setArchiveDataError(errorMessage);
    setArchiveData({ timesheet: [], credentials: [] });
    setIsArchiveDataLoading(false);
  }, []);

  const parseArchiveResponse = useCallback((archiveResponse: unknown): { timesheet: TimesheetEntry[]; credentials: Credential[] } => {
    const response = archiveResponse as { success?: boolean; timesheet?: TimesheetEntry[]; credentials?: Credential[] };
    const timesheetData: TimesheetEntry[] = response?.success ? (response.timesheet ?? []) : [];
    const credentialsData: Credential[] = response?.success ? (response.credentials ?? []) : [];
    return { timesheet: timesheetData, credentials: credentialsData };
  }, []);

  const loadArchiveData = useCallback(async () => {
    try {
      setIsArchiveDataLoading(true);
      setArchiveDataError(null);
      
      if (!token) {
        logWarn('[DataContext] Cannot load archive data: no session token');
        setArchiveDataError('Session token is required. Please log in to view archive data.');
        setArchiveData({ timesheet: [], credentials: [] });
        setIsArchiveDataLoading(false);
        return;
      }
      
      logVerbose('[DataContext] Loading archive data...');
      await yieldToMain();
      
      const archiveResponse = await getAllArchiveData(token);
      await yieldToMain();
      
      const { timesheet: timesheetData, credentials: credentialsData } = parseArchiveResponse(archiveResponse);
      
      if (timesheetData.length > 100) {
        logInfo('[DataContext] Processing large dataset', { count: timesheetData.length });
        await yieldToMain();
      }
      
      logInfo('[DataContext] Loaded archive data', {
        timesheetCount: timesheetData.length,
        credentialsCount: credentialsData.length
      });
      
      // Yield control before state updates
      await yieldToMain();
      
      setArchiveData({
        timesheet: timesheetData,
        credentials: credentialsData
      });
      
      // Check for errors
      if (!archiveResponse?.success) {
        setArchiveDataError(archiveResponse?.error || 'Could not load archive data');
      }
      
      setIsArchiveDataLoading(false);
    } catch (error) {
      handleArchiveLoadError(error);
    }
  }, [token, yieldToMain, parseArchiveResponse, handleArchiveLoadError]);

  /**
   * Force refresh timesheet draft data
   * 
   * Manually triggers data reload, typically called after:
   * - Timesheet submission completes
   * - User clicks refresh button
   * - Tab navigation activates timesheet view
   * 
   * Wrapped in useCallback to prevent infinite re-renders in effect dependencies.
   */
  const refreshTimesheetDraft = useCallback(async () => {
    logInfo('[DataContext] Refreshing timesheet draft data');
    await loadTimesheetDraftData();
  }, [loadTimesheetDraftData]);

  /**
   * Force refresh archive data
   * 
   * Manually triggers archive data reload, typically called after:
   * - Timesheet submission completes
   * - User clicks refresh button
   * - Tab navigation activates archive view
   * 
   * Automatically respects token dependency for proper auth handling.
   */
  const refreshArchiveData = useCallback(async () => {
    logInfo('[DataContext] Refreshing archive data');
    await loadArchiveData();
  }, [loadArchiveData]);

  useInitializeDataContext(
    setTimesheetDraftData,
    setArchiveData,
    setIsTimesheetDraftLoading,
    setIsArchiveDataLoading
  );

  const value: DataContextType = useMemo(() => ({
    timesheetDraftData,
    setTimesheetDraftData,
    refreshTimesheetDraft,
    archiveData,
    setArchiveData,
    refreshArchiveData,
    isTimesheetDraftLoading,
    isArchiveDataLoading,
    timesheetDraftError,
    archiveDataError
  }), [
    timesheetDraftData,
    archiveData,
    isTimesheetDraftLoading,
    isArchiveDataLoading,
    timesheetDraftError,
    archiveDataError,
    refreshTimesheetDraft,
    refreshArchiveData
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
