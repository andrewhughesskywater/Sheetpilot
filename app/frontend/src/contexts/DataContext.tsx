import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useSession } from "./SessionContext";
import { loadDraft } from "@/services/ipc/timesheet";
import { getAllArchiveData } from "@/services/ipc/database";
import {
  logError,
  logInfo,
  logVerbose,
  logWarn,
  logDebug,
} from "@/services/ipc/logger";

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

interface DatabaseData {
  timesheet: TimesheetEntry[];
  credentials: Credential[];
}

interface DataContextType {
  timesheetDraftData: TimesheetRow[];
  setTimesheetDraftData: (data: TimesheetRow[]) => void;
  refreshTimesheetDraft: () => Promise<void>;

  archiveData: DatabaseData;
  setArchiveData: (data: DatabaseData) => void;
  refreshArchiveData: () => Promise<void>;

  isTimesheetDraftLoading: boolean;
  isArchiveDataLoading: boolean;

  timesheetDraftError: string | null;
  archiveDataError: string | null;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const yieldToMain = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const handleMissingArchiveToken = (
  token: string | null,
  setArchiveDataError: Dispatch<SetStateAction<string | null>>,
  setArchiveData: Dispatch<SetStateAction<DatabaseData>>,
  setIsArchiveDataLoading: Dispatch<SetStateAction<boolean>>
): boolean => {
  if (token) {
    return false;
  }
  logWarn("[DataContext] Cannot load archive data: no session token");
  setArchiveDataError(
    "Session token is required. Please log in to view archive data."
  );
  setArchiveData({ timesheet: [], credentials: [] });
  setIsArchiveDataLoading(false);
  return true;
};

const maybeYieldForLargeArchive = async (
  timesheetCount: number
): Promise<void> => {
  if (timesheetCount <= 100) {
    return;
  }
  logInfo("[DataContext] Processing large dataset", {
    count: timesheetCount,
  });
  await yieldToMain();
};

// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
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
  const [timesheetDraftData, setTimesheetDraftData] = useState<TimesheetRow[]>([
    {},
  ]);
  const [isTimesheetDraftLoading, setIsTimesheetDraftLoading] = useState(true);
  const [timesheetDraftError, setTimesheetDraftError] = useState<string | null>(
    null
  );

  // Archive data state
  const [archiveData, setArchiveData] = useState<DatabaseData>({
    timesheet: [],
    credentials: [],
  });
  const [isArchiveDataLoading, setIsArchiveDataLoading] = useState(true);
  const [archiveDataError, setArchiveDataError] = useState<string | null>(null);

  const loadTimesheetDraftData = useCallback(async () => {
    try {
      logDebug("[DataContext] Setting loading true for timesheet draft");
      setIsTimesheetDraftLoading(true);
      setTimesheetDraftError(null);

      logVerbose("[DataContext] Loading timesheet draft data...");

      // Yield control before making IPC call
      await yieldToMain();

      const response = await loadDraft();

      // Yield control after IPC call
      await yieldToMain();

      logVerbose("[DataContext] Loaded timesheet draft response", response);

      // Handle new structured response format
      if (response && response.success) {
        const draftData = response.entries || [];
        // Add one blank row at the end if we have data
        const rowsWithBlank =
          draftData.length > 0 && Object.keys(draftData[0] || {}).length > 0
            ? [...draftData, {}]
            : [{}];
        setTimesheetDraftData(rowsWithBlank);
      } else {
        // Handle old format or error
        const errorMsg = response?.error || "Could not load timesheet draft";
        setTimesheetDraftError(errorMsg);
        setTimesheetDraftData([{}]);
      }
    } catch (error) {
      logError("Error loading timesheet draft data", {
        error: error instanceof Error ? error.message : String(error),
      });

      setTimesheetDraftError(
        error instanceof Error
          ? error.message
          : "Could not load timesheet draft"
      );
      setTimesheetDraftData([{}]); // Fallback to empty row
    } finally {
      logDebug("[DataContext] Setting loading false for timesheet draft");
      setIsTimesheetDraftLoading(false);
    }
  }, []);

  const loadArchiveData = useCallback(async () => {
    try {
      setIsArchiveDataLoading(true);
      setArchiveDataError(null);

      // Require token for authenticated archive access
      if (
        handleMissingArchiveToken(
          token,
          setArchiveDataError,
          setArchiveData,
          setIsArchiveDataLoading
        )
      ) {
        return;
      }

      logVerbose("[DataContext] Loading archive data...");

      // Yield control before making IPC call
      await yieldToMain();

      // Use batched API to fetch both timesheet and credentials in one call
      const archiveResponse = await getAllArchiveData(token as string);

      // Yield control after IPC call
      await yieldToMain();

      // Parse batched response
      const timesheetData: TimesheetEntry[] = archiveResponse?.success
        ? archiveResponse.timesheet ?? []
        : [];

      const credentialsData: Credential[] = archiveResponse?.success
        ? archiveResponse.credentials ?? []
        : [];

      // Yield control for large datasets to prevent blocking
      await maybeYieldForLargeArchive(timesheetData.length);

      logInfo("[DataContext] Loaded archive data", {
        timesheetCount: timesheetData.length,
        credentialsCount: credentialsData.length,
      });

      // Yield control before state updates
      await yieldToMain();

      setArchiveData({
        timesheet: timesheetData,
        credentials: credentialsData,
      });

      // Check for errors
      if (!archiveResponse?.success) {
        setArchiveDataError(
          archiveResponse?.error || "Could not load archive data"
        );
      }
    } catch (error) {
      logError("Error loading archive data", {
        error: error instanceof Error ? error.message : String(error),
      });
      setArchiveDataError(
        error instanceof Error ? error.message : "Could not load archive data"
      );
      setArchiveData({ timesheet: [], credentials: [] }); // Fallback to empty data
    } finally {
      setIsArchiveDataLoading(false);
    }
  }, [token]);

  const refreshTimesheetDraft = useCallback(async () => {
    logInfo("[DataContext] Refreshing timesheet draft data");
    await loadTimesheetDraftData();
  }, [loadTimesheetDraftData]);

  const refreshArchiveData = useCallback(async () => {
    logInfo("[DataContext] Refreshing archive data");
    await loadArchiveData();
  }, [loadArchiveData]);

  useEffect(() => {
    logInfo(
      "[DataContext] Skipping startup data loading to prevent performance violations"
    );

    // Set initial empty state immediately
    setTimesheetDraftData([{}]);
    setArchiveData({ timesheet: [], credentials: [] });

    // Mark as not loading since we're not loading anything
    setIsTimesheetDraftLoading(false);
    setIsArchiveDataLoading(false);
  }, []);

  const value: DataContextType = useMemo(
    () => ({
      timesheetDraftData,
      setTimesheetDraftData,
      refreshTimesheetDraft,
      archiveData,
      setArchiveData,
      refreshArchiveData,
      isTimesheetDraftLoading,
      isArchiveDataLoading,
      timesheetDraftError,
      archiveDataError,
    }),
    [
      timesheetDraftData,
      archiveData,
      refreshTimesheetDraft,
      refreshArchiveData,
      isTimesheetDraftLoading,
      isArchiveDataLoading,
      timesheetDraftError,
      archiveDataError,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
