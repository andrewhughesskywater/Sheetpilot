import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// Define data types
interface TimesheetRow {
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

  // Load timesheet draft data
  const loadTimesheetDraftData = async () => {
    try {
      setIsTimesheetDraftLoading(true);
      setTimesheetDraftError(null);
      
      console.log('[DataContext] Loading timesheet draft data...');
      const draftData = await window.timesheet.loadDraft();
      console.log('[DataContext] Loaded timesheet draft data:', draftData);
      
      // Add one blank row at the end if we have data
      const rowsWithBlank = draftData.length > 0 ? [...draftData, {}] : [{}];
      setTimesheetDraftData(rowsWithBlank);
    } catch (error) {
      console.error('[DataContext] Error loading timesheet draft data:', error);
      setTimesheetDraftError(error instanceof Error ? error.message : 'Failed to load timesheet draft');
      setTimesheetDraftData([{}]); // Fallback to empty row
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
      const timesheetData = await window.database?.getAllTimesheetEntries();
      const credentialsData = await window.database?.getAllCredentials();
      
      console.log('[DataContext] Loaded archive data:', {
        timesheetCount: timesheetData?.length || 0,
        credentialsCount: credentialsData?.length || 0
      });
      
      setArchiveData({
        timesheet: timesheetData || [],
        credentials: credentialsData || []
      });
    } catch (error) {
      console.error('[DataContext] Error loading archive data:', error);
      setArchiveDataError(error instanceof Error ? error.message : 'Failed to load archive data');
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
