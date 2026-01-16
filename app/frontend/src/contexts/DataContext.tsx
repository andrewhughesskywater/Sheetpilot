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
  /** Hours worked as decimal (15-minute increments: 0.25, 0.5, 0.75, 1.0, etc.) */
  hours?: number;
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
 */
interface TimesheetEntry {
  /** Database ID */
  id: number;
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Hours worked as decimal (15-minute increments) */
  hours: number | null;
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

  /**
   * Load timesheet draft data from database
   *
   * Fetches pending timesheet entries and prepares them for editing.
   * Implements yielding strategy to prevent blocking UI thread.
   *
   * Data flow:
   * 1. Set loading state
   * 2. Yield to main thread
   * 3. Fetch draft entries via IPC
   * 4. Yield after IPC call
   * 5. Add blank row for data entry
   * 6. Update state and clear loading
   *
   * Error handling:
   * - Sets error state on failure
   * - Always provides fallback empty row
   * - Logs errors for troubleshooting
   */
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
      const archiveResponse = await getAllArchiveData(token);

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
    logInfo("[DataContext] Refreshing timesheet draft data");
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
    logInfo("[DataContext] Refreshing archive data");
    await loadArchiveData();
  }, [loadArchiveData]);

  /**
   * Initialize context state on mount
   *
   * WHY: Intentionally skips data loading during startup to meet performance budgets.
   * Loading data on mount violates long task performance targets (>50ms) and blocks
   * initial render. Instead, data loads on-demand when user navigates to tabs.
   *
   * This architecture decision improves:
   * - Time to Interactive (TTI)
   * - First Contentful Paint (FCP)
   * - Cumulative Layout Shift (CLS)
   *
   * Trade-off: Slight delay when first viewing each tab, but much faster startup.
   */
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
