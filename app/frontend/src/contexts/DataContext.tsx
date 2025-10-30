import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSession } from './SessionContext';

// Define data types
interface TimesheetRow {
  id?: number;
  date?: string;
  timeIn?: string;
  timeOut?: string;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
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

interface DatabaseData {
  timesheet: TimesheetEntry[];
  credentials: Credential[];
}

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

  // Restore from localStorage backup if database fails
  const restoreFromLocalBackup = (): TimesheetRow[] | null => {
    try {
      const backup = localStorage.getItem('sheetpilot_timesheet_backup');
      if (backup) {
        const parsed = JSON.parse(backup);
        window.logger?.debug('[DataContext] Found localStorage backup from:', parsed.timestamp);
        return parsed.data || null;
      }
    } catch (error) {
      console.error('[DataContext] Could not restore from localStorage backup:', error);
    }
    return null;
  };

  // Utility function to yield control back to the browser
  const yieldToMain = () => {
    return new Promise(resolve => {
      setTimeout(resolve, 0);
    });
  };

  // Load timesheet draft data - with proper yielding to prevent blocking
  const loadTimesheetDraftData = async () => {
    try {
      window.logger?.debug('[DataContext] Setting loading true for timesheet draft');
      setIsTimesheetDraftLoading(true);
      setTimesheetDraftError(null);
      
      window.logger?.verbose('[DataContext] Loading timesheet draft data...');
      
      // Yield control before making IPC call
      await yieldToMain();
      
      if (!window.timesheet?.loadDraft) {
        throw new Error('Timesheet API not available');
      }
      
      const response = await window.timesheet.loadDraft();
      
      // Yield control after IPC call
      await yieldToMain();
      
      window.logger?.verbose('[DataContext] Loaded timesheet draft response', response);
      
      // Handle new structured response format
      if (response && response.success) {
        const draftData = response.entries || [];
        // Add one blank row at the end if we have data
        const rowsWithBlank = draftData.length > 0 && Object.keys(draftData[0] || {}).length > 0 
          ? [...draftData, {}] 
          : [{}];
        setTimesheetDraftData(rowsWithBlank);
      } else {
        // Handle old format or error - try to restore from localStorage backup
        const errorMsg = response?.error || 'Could not load timesheet draft';
        console.warn('[DataContext] Database load failed, attempting localStorage restore...');
        
        const backupData = restoreFromLocalBackup();
        if (backupData && backupData.length > 0) {
          window.logger?.info('[DataContext] Restored from localStorage backup', { rowCount: backupData.length });
          setTimesheetDraftError(`${errorMsg} (restored from backup)`);
          setTimesheetDraftData([...backupData, {}]);
        } else {
          setTimesheetDraftError(errorMsg);
          setTimesheetDraftData([{}]);
        }
      }
    } catch (error) {
      console.error('[DataContext] Error loading timesheet draft data:', error);
      
      // Try to restore from localStorage backup on error
      const backupData = restoreFromLocalBackup();
      if (backupData && backupData.length > 0) {
        window.logger?.info('[DataContext] Restored from localStorage backup after error', { rowCount: backupData.length });
        setTimesheetDraftError(`${error instanceof Error ? error.message : 'Could not load timesheet draft'} (restored from backup)`);
        setTimesheetDraftData([...backupData, {}]);
      } else {
        setTimesheetDraftError(error instanceof Error ? error.message : 'Could not load timesheet draft');
        setTimesheetDraftData([{}]); // Fallback to empty row
      }
    } finally {
      window.logger?.debug('[DataContext] Setting loading false for timesheet draft');
      setIsTimesheetDraftLoading(false);
    }
  };

  // Load archive data - with proper yielding to prevent blocking
  const loadArchiveData = async () => {
    try {
      setIsArchiveDataLoading(true);
      setArchiveDataError(null);
      
      // Do not hard-require token here; archive loads from local DB via IPC
      // Session gating is handled at the app level
      
      window.logger?.verbose('[DataContext] Loading archive data...');
      
      // Yield control before making IPC calls
      await yieldToMain();
      
      const timesheetResponse = await window.database?.getAllTimesheetEntries(token ?? '');
      
      // Yield control between IPC calls
      await yieldToMain();
      
      const credentialsResponse = await window.database?.getAllCredentials();
      
      // Yield control after IPC calls
      await yieldToMain();
      
      // Support both structured and array responses
      const timesheetData: TimesheetEntry[] = Array.isArray(timesheetResponse)
        ? timesheetResponse
        : (timesheetResponse && (timesheetResponse as { success?: boolean; entries?: TimesheetEntry[] }).success)
          ? ((timesheetResponse as { entries?: TimesheetEntry[] }).entries ?? [])
          : [];

      const credentialsData: Credential[] = Array.isArray(credentialsResponse)
        ? credentialsResponse
        : (credentialsResponse && (credentialsResponse as { success?: boolean; credentials?: Credential[] }).success)
          ? ((credentialsResponse as { credentials?: Credential[] }).credentials ?? [])
          : [];
      
      // Process large datasets in chunks to prevent blocking
      if (timesheetData.length > 100) {
        window.logger?.info('[DataContext] Processing large dataset in chunks', { count: timesheetData.length });
        
        // Process in chunks of 50 items
        const chunkSize = 50;
        for (let i = 0; i < timesheetData.length; i += chunkSize) {
          // Process chunk here if needed
          await yieldToMain(); // Yield control between chunks
        }
      }
      
      window.logger?.info('[DataContext] Loaded archive data', {
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
      if (timesheetResponse && !Array.isArray(timesheetResponse) && !(timesheetResponse as { success?: boolean }).success) {
        setArchiveDataError((timesheetResponse as { error?: string }).error || 'Could not load timesheet data');
      } else if (credentialsResponse && !Array.isArray(credentialsResponse) && !(credentialsResponse as { success?: boolean }).success) {
        setArchiveDataError((credentialsResponse as { error?: string }).error || 'Could not load credentials data');
      }
    } catch (error) {
      console.error('[DataContext] Error loading archive data:', error);
      setArchiveDataError(error instanceof Error ? error.message : 'Could not load archive data');
      setArchiveData({ timesheet: [], credentials: [] }); // Fallback to empty data
    } finally {
      setIsArchiveDataLoading(false);
    }
  };

  // Refresh functions - force reload data
  // Wrapped in useCallback to prevent infinite re-renders
  const refreshTimesheetDraft = useCallback(async () => {
    window.logger?.info('[DataContext] Refreshing timesheet draft data');
    await loadTimesheetDraftData();
  }, []);

  // IMPORTANT: depend on token so we don't capture a stale value
  const refreshArchiveData = useCallback(async () => {
    window.logger?.info('[DataContext] Refreshing archive data');
    await loadArchiveData();
  }, [token]);

  // Load data on mount - completely disabled during startup to prevent blocking
  useEffect(() => {
    // Don't load any data during startup - only load when user actually needs it
    window.logger?.info('[DataContext] Skipping startup data loading to prevent performance violations');
    
    // Set initial empty state immediately
    setTimesheetDraftData([{}]);
    setArchiveData({ timesheet: [], credentials: [] });
    
    // Mark as not loading since we're not loading anything
    setIsTimesheetDraftLoading(false);
    setIsArchiveDataLoading(false);
  }, []);

  const value: DataContextType = {
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
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
