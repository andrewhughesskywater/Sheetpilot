import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

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

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
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
        console.log('[DataContext] Found localStorage backup from:', parsed.timestamp);
        return parsed.data || null;
      }
    } catch (error) {
      console.error('[DataContext] Could not restore from localStorage backup:', error);
    }
    return null;
  };

  // Load timesheet draft data
  const loadTimesheetDraftData = async () => {
    try {
      setIsTimesheetDraftLoading(true);
      setTimesheetDraftError(null);
      
      console.log('[DataContext] Loading timesheet draft data...');
      const response = await window.timesheet.loadDraft();
      console.log('[DataContext] Loaded timesheet draft response:', response);
      
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
          console.log('[DataContext] Restored from localStorage backup:', backupData.length, 'rows');
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
        console.log('[DataContext] Restored from localStorage backup after error:', backupData.length, 'rows');
        setTimesheetDraftError(`${error instanceof Error ? error.message : 'Could not load timesheet draft'} (restored from backup)`);
        setTimesheetDraftData([...backupData, {}]);
      } else {
        setTimesheetDraftError(error instanceof Error ? error.message : 'Could not load timesheet draft');
        setTimesheetDraftData([{}]); // Fallback to empty row
      }
    } finally {
      setIsTimesheetDraftLoading(false);
    }
  };

  // Load archive data
  const loadArchiveData = async () => {
    try {
      setIsArchiveDataLoading(true);
      setArchiveDataError(null);
      
      console.log('[DataContext] Loading archive data...');
      const timesheetResponse = await window.database?.getAllTimesheetEntries();
      const credentialsResponse = await window.database?.getAllCredentials();
      
      // Handle new structured response format
      const timesheetData = timesheetResponse?.success ? (timesheetResponse.entries || []) : [];
      const credentialsData = credentialsResponse?.success ? (credentialsResponse.credentials || []) : [];
      
      console.log('[DataContext] Loaded archive data:', {
        timesheetCount: timesheetData.length,
        credentialsCount: credentialsData.length
      });
      
      setArchiveData({
        timesheet: timesheetData,
        credentials: credentialsData
      });
      
      // Check for errors
      if (timesheetResponse && !timesheetResponse.success) {
        setArchiveDataError(timesheetResponse.error || 'Could not load timesheet data');
      } else if (credentialsResponse && !credentialsResponse.success) {
        setArchiveDataError(credentialsResponse.error || 'Could not load credentials data');
      }
    } catch (error) {
      console.error('[DataContext] Error loading archive data:', error);
      setArchiveDataError(error instanceof Error ? error.message : 'Could not load archive data');
      setArchiveData({ timesheet: [], credentials: [] }); // Fallback to empty data
    } finally {
      setIsArchiveDataLoading(false);
    }
  };

  // Refresh functions
  const refreshTimesheetDraft = async () => {
    await loadTimesheetDraftData();
  };

  const refreshArchiveData = async () => {
    // Add a small delay to ensure database updates are complete
    setTimeout(async () => {
      await loadArchiveData();
    }, 100);
  };

  // Load data on mount
  useEffect(() => {
    const loadAllData = async () => {
      console.log('[DataContext] Initializing data loading...');
      
      // Load both datasets in parallel
      await Promise.all([
        loadTimesheetDraftData(),
        loadArchiveData()
      ]);
      
      console.log('[DataContext] All data loaded successfully');
    };

    loadAllData();
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
