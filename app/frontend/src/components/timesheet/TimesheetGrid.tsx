/**
 * @fileoverview TimesheetGrid Component
 *
 * Core timesheet data entry component using Handsontable for spreadsheet-like data manipulation.
 * Handles real-time validation, auto-save with debouncing, macro support, and timesheet submission.
 *
 * Key features:
 * - Real-time validation with visual feedback (no blocking validators to prevent editor issues)
 * - Individual row auto-save with debouncing and receipt verification
 * - Smart date suggestions with weekday pattern detection
 * - Time overlap detection to prevent double-booking
 * - Macro system for quick data entry (Ctrl+1-5)
 * - Keyboard shortcuts for date entry (Tab, Shift+Tab, Ctrl+Tab, Ctrl+T)
 * - Cascading business rules (project → tool → charge code dependencies)
 *
 * Architecture decisions:
 * - Validators removed from column config to prevent editor blocking (validation in afterChange)
 * - Individual row saves instead of batch saves for better UX and data safety
 * - Receipt verification system to handle race conditions during rapid edits
 * - Hidden ID column (col 0) as "Golden Rule" for Handsontable-SQL sync
 */

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  memo,
} from "react";
import { HotTable } from "@handsontable/react-wrapper";
import { registerAllModules } from "handsontable/registry";
import { registerEditor } from "handsontable/editors";
import type { HotTableRef } from "@handsontable/react-wrapper";
import "handsontable/styles/handsontable.css";
import "handsontable/styles/ht-theme-horizon.css";
import { useData } from "@/contexts/DataContext";
import { useSession } from "@/contexts/SessionContext";
import "./TimesheetGrid.css";
import type { TimesheetRow } from "./schema/timesheet.schema";
import MacroManagerDialog from "./macros/MacroManagerDialog";
import KeyboardShortcutsHintDialog from "@/components/KeyboardShortcutsHintDialog";
import { ValidationErrorDialog } from "./validation/ValidationErrorDialog";
import TimesheetGridLoadingState from "./components/TimesheetGridLoadingState";
import TimesheetGridHeader from "./components/TimesheetGridHeader";
import MacroToolbar from "./macros/MacroToolbar";
import TimesheetGridFooter from "./components/TimesheetGridFooter";
import type { MacroRow } from "@/utils/macroStorage";
import { isMacroEmpty } from "@/utils/macroStorage";
import type { ValidationError } from "./cell-processing/timesheet.cell-processing";
import type { ButtonStatus } from "./TimesheetGrid.types";
import { normalizeRowData } from "./schema/timesheet.schema";
import { getColumnDefinitions } from "./column-config/timesheet.column-config";
import { submitTimesheet } from "./submit/timesheet.submit";
import { SpellcheckEditor } from "./editors/SpellcheckEditor";
import {
  getSmartPlaceholder,
  incrementDate,
  formatDateForDisplay,
} from "@/utils/smartDate";
import {
  getAllProjectsAsync,
  getAllChargeCodesAsync,
} from "@sheetpilot/shared/business-config";
import {
  cancelTimesheetSubmission,
  loadDraft as loadDraftIpc,
  resetInProgress as resetInProgressIpc,
} from "@/services/ipc/timesheet";
import { logError, logInfo, logWarn, logVerbose } from "@/services/ipc/logger";
import { processCellChange } from "./cell-processing/timesheet.cell-processing";
import {
  applyPastedToolAndChargeCode,
  normalizePastedRows,
  savePastedRows,
} from "./paste-handlers/timesheet.paste-handlers";
import {
  createSaveAndReloadRow,
  createUpdateSaveButtonState,
  createApplyMacro,
  createDuplicateSelectedRow,
  createCellsFunction,
} from "./row-operations/timesheet.row-operations";
import {
  createHandleAfterChange,
  createHandleAfterRemoveRow,
  createHandleAfterPaste,
  createHandleSubmitTimesheet,
  createHandleStopSubmission,
  createHandleBeforeKeyDown,
  createHandleAfterSelection,
  createHandleManualSave,
  createHandleRefresh,
} from "./handlers/timesheet.handlers";
import {
  projectNeedsToolsWrapper,
  toolNeedsChargeCodeWrapper,
  getToolsForProjectWrapper,
  registerTimesheetShortcuts,
  calculateButtonStatus,
} from "./TimesheetGrid.helpers";
import {
  HOTTABLE_CONTEXT_MENU,
  HOTTABLE_COLUMN_SORTING,
} from "./TimesheetGrid.config";
import {
  useLoadMacros,
  useWeekdayPattern,
  useDialogScrollbarFix,
  useFlushPendingSavesOnUnmount,
  useSyncTimesheetData,
  useBatchSaveToDatabase,
  useHandleBeforePaste,
  useHandleAfterBeginEditing,
} from "./TimesheetGrid.hooks";

// Register all Handsontable modules
registerAllModules();
// Register custom spellcheck editor
registerEditor("spellcheckText", SpellcheckEditor);
// NOTE: Column validators removed - they block editor closing and cause navigation issues
// Validation now happens in afterChange hook using setCellMeta for visual feedback

type HotInstance = NonNullable<HotTableRef["hotInstance"]>;

const updateColumnSource = (
  hot: HotInstance,
  columnIndex: number,
  source: readonly string[],
  logMessage: string
): boolean => {
  if (source.length === 0) {
    return false;
  }
  
  const columns = hot.getSettings().columns;
  if (!Array.isArray(columns) || !columns[columnIndex]) {
    return false;
  }
  const currentColumn = columns[columnIndex];
  const currentSource = currentColumn?.source;
  
  // Check if source has actually changed to prevent infinite update loops
  if (
    Array.isArray(currentSource) &&
    currentSource.length === source.length &&
    currentSource.every((val, idx) => val === source[idx])
  ) {
    return false; // Source hasn't changed, no update needed
  }
  
  // Return true to indicate an update is needed (caller will batch updates)
  return true;
};

const updateAllColumnSources = (
  hot: HotInstance,
  updates: Array<{ columnIndex: number; source: readonly string[]; logMessage: string }>
): void => {
  logVerbose("[TimesheetGrid] updateAllColumnSources called", {
    updateCount: updates.length,
    stack: new Error().stack?.split('\n').slice(1, 5).join('\n'),
  });
  
  const columns = hot.getSettings().columns;
  if (!Array.isArray(columns)) {
    logVerbose("[TimesheetGrid] updateAllColumnSources: columns not an array");
    return;
  }
  
  let hasChanges = false;
  
  // Check if any update actually changes the source
  updates.forEach((update) => {
    const column = columns[update.columnIndex];
    if (!column) return;
    
    const currentSource = column.source;
    const sourceChanged =
      !Array.isArray(currentSource) ||
      currentSource.length !== update.source.length ||
      !currentSource.every((val, idx) => val === update.source[idx]);
    
    if (sourceChanged) {
      hasChanges = true;
    }
  });
  
  if (!hasChanges) {
    logVerbose("[TimesheetGrid] updateAllColumnSources: no changes needed, skipping updateSettings");
    return; // No changes needed
  }
  
  logVerbose("[TimesheetGrid] updateAllColumnSources: has changes, will call updateSettings", {
    columnCount: columns.length,
  });
  
  // Apply all updates in a single updateSettings call
  const nextColumns = columns.map((column, index) => {
    const update = updates.find((u) => u.columnIndex === index);
    if (update) {
      return { ...column, source: [...update.source] };
    }
    return column;
  });
  
  // WHY: Use requestAnimationFrame to defer updateSettings outside of the current
  // React render cycle. This breaks the synchronous cycle where updateSettings
  // triggers Handsontable hooks that update React state, which retriggers effects.
  // Note: hot instance is captured in closure - if component unmounts, this becomes a no-op
  requestAnimationFrame(() => {
    try {
      logVerbose("[TimesheetGrid] updateAllColumnSources: calling updateSettings in requestAnimationFrame");
      hot.updateSettings({ columns: nextColumns });
      updates.forEach((u) => logVerbose(u.logMessage));
      logVerbose("[TimesheetGrid] updateAllColumnSources: updateSettings completed");
    } catch (error) {
      logError("[TimesheetGrid] updateAllColumnSources: error calling updateSettings", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};

interface TimesheetGridProps {
  onChange?: (rows: TimesheetRow[]) => void;
}

export interface TimesheetGridHandle {
  batchSaveToDatabase: () => Promise<void>;
}

/**
 * Core timesheet grid component with spreadsheet interface
 *
 * Provides Excel-like data entry with real-time validation, auto-save, and smart features.
 * Uses forwardRef to expose batchSaveToDatabase for parent component control.
 *
 * Key behaviors:
 * - Individual row auto-save with 500ms debounce
 * - Receipt verification to handle race conditions during rapid edits
 * - Smart date suggestions based on previous entries and patterns
 * - Time overlap detection to prevent double-booking
 * - Cascading dropdowns (project → tool → charge code)
 * - Macro support for quick data entry (Ctrl+1-5)
 * - Keyboard shortcuts for date entry
 *
 * Performance optimizations:
 * - Lazy component loading
 * - Debounced saves per row
 * - Abort controllers for in-flight saves
 * - updateData() instead of loadData() to preserve UI state
 *
 * @param props - Component props
 * @param props.onChange - Optional callback fired when data changes
 * @param ref - Forward ref exposing batchSaveToDatabase method
 * @returns Timesheet grid with toolbar and dialogs
 */
const TimesheetGrid = forwardRef<TimesheetGridHandle, TimesheetGridProps>(
  function TimesheetGrid({ onChange }, ref) {
    // Track render count and what changed between renders
    const renderCountRef = useRef(0);
    const prevPropsRef = useRef({ onChange });
    const prevStateRef = useRef<Record<string, unknown>>({});
    
    renderCountRef.current += 1;
    
    const hotTableRef = useRef<HotTableRef>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const isProcessingRef = useRef(false); // Synchronous guard against race conditions
    const { token, isAdmin } = useSession();

    // Macro state
    const [macros, setMacros] = useState<MacroRow[]>([]);
    const [showMacroDialog, setShowMacroDialog] = useState(false);

    // Keyboard shortcuts hint dialog state
    const [showShortcutsHint, setShowShortcutsHint] = useState(false);

    // Validation error state
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
      []
    );
    const [showErrorDialog, setShowErrorDialog] = useState(false);

    const weekdayPatternRef = useRef<boolean>(false);
    const previousSelectionRef = useRef<{ row: number; col: number } | null>(
      null
    );
    const pendingSaveRef = useRef<Map<number, TimesheetRow>>(new Map());
    const saveTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
      new Map()
    );
    const inFlightSavesRef = useRef<Map<number, AbortController>>(new Map());
    const [saveButtonState, setSaveButtonState] = useState<
      "saved" | "saving" | "save"
    >("saved");
    const unsavedRowsRef = useRef<Map<number, TimesheetRow>>(new Map());
    const saveStartTimeRef = useRef<number | null>(null);

    const {
      timesheetDraftData,
      setTimesheetDraftData,
      isTimesheetDraftLoading,
      timesheetDraftError,
      refreshTimesheetDraft,
      refreshArchiveData,
      archiveData,
    } = useData();
    
    // Track what changed between renders to identify loop cause
    useEffect(() => {
      const currentProps = { onChange };
      const currentState = {
        isProcessing,
        macros: macros.length,
        showMacroDialog,
        showShortcutsHint,
        validationErrors: validationErrors.length,
        showErrorDialog,
        saveButtonState,
        timesheetDraftData: timesheetDraftData.length,
        isTimesheetDraftLoading,
        timesheetDraftError,
        token,
        isAdmin,
        archiveData: archiveData.timesheet.length,
      };
      
      const propChanged = currentProps.onChange !== prevPropsRef.current.onChange;
      const stateChanges: string[] = [];
      
      Object.keys(currentState).forEach((key) => {
        const currentValue = currentState[key as keyof typeof currentState];
        const prevValue = prevStateRef.current[key];
        if (currentValue !== prevValue) {
          stateChanges.push(`${key}: ${prevValue} -> ${currentValue}`);
        }
      });
      
      if (renderCountRef.current <= 5 || (renderCountRef.current > 5 && renderCountRef.current % 50 === 0)) {
        logVerbose("[TimesheetGrid] Component render", {
          renderCount: renderCountRef.current,
          propChanged,
          stateChanges: stateChanges.length > 0 ? stateChanges : ["none"],
          onChangeRefChanged: currentProps.onChange !== prevPropsRef.current.onChange,
          timesheetDraftDataRefChanged: timesheetDraftData !== prevStateRef.current.timesheetDraftDataRef,
        });
      }
      
      if (renderCountRef.current > 10 && renderCountRef.current % 100 === 0) {
        logVerbose("[TimesheetGrid] Component rendered many times", {
          renderCount: renderCountRef.current,
          recentStateChanges: stateChanges.slice(-5),
          stack: new Error().stack?.split('\n').slice(1, 8).join('\n'),
        });
      }
      
      prevPropsRef.current = currentProps;
      prevStateRef.current = { ...currentState, timesheetDraftDataRef: timesheetDraftData };
    });

    const isProcessingChangeRef = useRef(false);
    const businessConfigAppliedRef = useRef(false);
    
    // Wrap setters to track what's calling them - use refs to create stable callbacks
    const renderCountRefForLogging = useRef(0);
    const setMacrosRef = useRef(setMacros);
    const setSaveButtonStateRef = useRef(setSaveButtonState);
    const setValidationErrorsRef = useRef(setValidationErrors);
    const setTimesheetDraftDataRef = useRef(setTimesheetDraftData);
    const timesheetDraftDataForLoggingRef = useRef(timesheetDraftData);
    
    // Keep refs in sync without recreating callbacks
    useLayoutEffect(() => {
      setMacrosRef.current = setMacros;
      setSaveButtonStateRef.current = setSaveButtonState;
      setValidationErrorsRef.current = setValidationErrors;
      setTimesheetDraftDataRef.current = setTimesheetDraftData;
      timesheetDraftDataForLoggingRef.current = timesheetDraftData;
    });
    
    // Create stable wrapped setters that log but don't change on every render
    const wrappedSetMacros = useCallback((macros: MacroRow[]) => {
      renderCountRefForLogging.current += 1;
      const count = renderCountRefForLogging.current;
      if (count <= 5 || (count > 5 && count % 50 === 0)) {
        logVerbose("[TimesheetGrid] setMacros called", {
          renderCount: count,
          stack: new Error().stack?.split('\n').slice(1, 4).join('\n'),
        });
      }
      setMacrosRef.current(macros);
    }, []);
    
    const wrappedSetSaveButtonState = useCallback((state: "saved" | "saving" | "save") => {
      renderCountRefForLogging.current += 1;
      const count = renderCountRefForLogging.current;
      if (count <= 5 || (count > 5 && count % 50 === 0)) {
        logVerbose("[TimesheetGrid] setSaveButtonState called", {
          newState: state,
          renderCount: count,
          stack: new Error().stack?.split('\n').slice(1, 4).join('\n'),
        });
      }
      setSaveButtonStateRef.current(state);
    }, []);
    
    const wrappedSetValidationErrors = useCallback((updater: (prev: ValidationError[]) => ValidationError[]) => {
      renderCountRefForLogging.current += 1;
      const count = renderCountRefForLogging.current;
      if (count > 5 && count % 50 !== 0) {
        setValidationErrorsRef.current(updater);
        return;
      }
      logVerbose("[TimesheetGrid] setValidationErrors called", {
        renderCount: count,
        stack: new Error().stack?.split('\n').slice(1, 4).join('\n'),
      });
      setValidationErrorsRef.current(updater);
    }, []);
    
    const wrappedSetTimesheetDraftData = useCallback((data: TimesheetRow[]) => {
      renderCountRefForLogging.current += 1;
      const count = renderCountRefForLogging.current;
      if (count <= 5 || (count > 5 && count % 50 === 0)) {
        logVerbose("[TimesheetGrid] setTimesheetDraftData called", {
          renderCount: count,
          newLength: data.length,
          currentLength: timesheetDraftDataForLoggingRef.current.length,
          dataReferenceChanged: data !== timesheetDraftDataForLoggingRef.current,
          stack: new Error().stack?.split('\n').slice(1, 8).join('\n'),
        });
      }
      setTimesheetDraftDataRef.current(data);
    }, []);
    
    useSyncTimesheetData(timesheetDraftData, hotTableRef, onChange);
    useLoadMacros((macros) => wrappedSetMacros(macros as MacroRow[]));
    useWeekdayPattern(timesheetDraftData, weekdayPatternRef);
    useDialogScrollbarFix(showMacroDialog, hotTableRef);

    // Load business config asynchronously and update column sources
    // WHY: Only run once on mount to prevent infinite loops with updateSettings
    useEffect(() => {
      logVerbose("[TimesheetGrid] Business config useEffect triggered", {
        alreadyApplied: businessConfigAppliedRef.current,
        stack: new Error().stack?.split('\n').slice(1, 5).join('\n'),
      });
      
      if (businessConfigAppliedRef.current) {
        logVerbose("[TimesheetGrid] Business config already applied, skipping");
        return;
      }

      let isMounted = true;

      async function loadBusinessConfig() {
        logVerbose("[TimesheetGrid] loadBusinessConfig: starting async load");
        try {
          const [projectsResult, chargeCodesResult] = await Promise.all([
            getAllProjectsAsync(),
            getAllChargeCodesAsync(),
          ]);

          logVerbose("[TimesheetGrid] loadBusinessConfig: loaded config", {
            projectsCount: projectsResult.length,
            chargeCodesCount: chargeCodesResult.length,
            isMounted,
          });

          if (!isMounted) {
            logVerbose("[TimesheetGrid] loadBusinessConfig: component unmounted, aborting");
            return;
          }

          const hot = hotTableRef.current?.hotInstance;
          if (!hot) {
            logVerbose("[TimesheetGrid] loadBusinessConfig: hot instance not available");
            return;
          }

          // WHY: Temporarily disabled column source updates via updateSettings to prevent
          // infinite loops. The React wrapper's useEffect watches columns prop changes,
          // and calling updateSettings triggers hooks that cause the wrapper to detect
          // changes and call updateSettings again, creating a loop.
          // TODO: Find a way to update column sources without triggering the React wrapper's
          // sync mechanism, or pass sources directly through props instead of updateSettings.
          // For now, columns will use static sources from getColumnDefinitions().
          if (!businessConfigAppliedRef.current) {
            // DISABLED: updateAllColumnSources(hot, [...]);
            logVerbose(
              "[TimesheetGrid] Skipping dynamic column source update to prevent infinite loop. Using static sources from column definitions.",
              { alreadyApplied: businessConfigAppliedRef.current }
            );
            businessConfigAppliedRef.current = true;
          }
        } catch (error) {
          logWarn(
            "[TimesheetGrid] Could not load business config from database, using static config",
            {
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      }

      // Load config after a short delay to allow grid to initialize
      const timer = setTimeout(() => {
        void loadBusinessConfig();
      }, 100);

      return () => {
        logVerbose("[TimesheetGrid] Business config useEffect cleanup");
        isMounted = false;
        clearTimeout(timer);
      };
    }, []);
    const batchSaveToDatabase = useBatchSaveToDatabase(timesheetDraftData);
    // Expose batch save function to parent component via ref
    useImperativeHandle(ref, () => ({ batchSaveToDatabase }), [
      batchSaveToDatabase,
    ]);
    useFlushPendingSavesOnUnmount(
      saveTimersRef,
      pendingSaveRef,
      inFlightSavesRef
    );

    const rowsPendingRemovalRef = useRef<TimesheetRow[]>([]);
    const handleBeforeRemoveRow = useCallback(
      (index: number, amount: number) => {
        const start = Math.max(0, index);
        const _end = Math.min(timesheetDraftData.length, index + amount);
        rowsPendingRemovalRef.current = timesheetDraftData.slice(start, _end);
        window.logger?.verbose("[TimesheetGrid] Captured rows for deletion", {
          start,
          amount,
          captured: rowsPendingRemovalRef.current.length,
        });
      },
      [timesheetDraftData]
    );
    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const updateSaveButtonState = useCallback(
      createUpdateSaveButtonState(
        unsavedRowsRef,
        inFlightSavesRef,
        saveStartTimeRef,
        wrappedSetSaveButtonState
      ),
      [unsavedRowsRef, inFlightSavesRef, saveStartTimeRef, wrappedSetSaveButtonState]
    );
    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const saveAndReloadRow = useCallback(
      createSaveAndReloadRow(
        hotTableRef,
        wrappedSetTimesheetDraftData,
        onChange,
        updateSaveButtonState,
        inFlightSavesRef,
        unsavedRowsRef,
        pendingSaveRef
      ),
      [
        hotTableRef,
        wrappedSetTimesheetDraftData,
        onChange,
        updateSaveButtonState,
        inFlightSavesRef,
        unsavedRowsRef,
        pendingSaveRef,
      ]
    );
    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleAfterChange = useCallback(
      createHandleAfterChange(
        hotTableRef,
        timesheetDraftData,
        wrappedSetTimesheetDraftData,
        onChange,
        isProcessingChangeRef,
        saveAndReloadRow,
        wrappedSetValidationErrors,
        wrappedSetSaveButtonState,
        unsavedRowsRef,
        saveTimersRef,
        processCellChange,
        normalizeRowData,
        projectNeedsToolsWrapper,
        toolNeedsChargeCodeWrapper
      ),
      [
        hotTableRef,
        timesheetDraftData,
        setTimesheetDraftData,
        onChange,
        isProcessingChangeRef,
        saveAndReloadRow,
        setValidationErrors,
        setSaveButtonState,
        unsavedRowsRef,
        saveTimersRef,
      ]
    );
    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleAfterRemoveRow = useCallback(
      createHandleAfterRemoveRow(
        hotTableRef,
        timesheetDraftData,
        wrappedSetTimesheetDraftData,
        onChange,
        rowsPendingRemovalRef
      ),
      [
        hotTableRef,
        timesheetDraftData,
        wrappedSetTimesheetDraftData,
        onChange,
        rowsPendingRemovalRef,
      ]
    );
    // WHY: Handsontable's strict validation blocks paste for Tool/Charge Code dropdowns
    // when values aren't in current dropdown source. We bypass this by allowing paste,
    // then manually applying Tool/Charge Code in afterPaste with relaxed validation.
    const handleBeforePaste = useHandleBeforePaste();

    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleAfterPaste = useCallback(
      createHandleAfterPaste(
        hotTableRef,
        wrappedSetTimesheetDraftData,
        onChange,
        saveTimersRef,
        pendingSaveRef,
        saveAndReloadRow,
        applyPastedToolAndChargeCode,
        normalizePastedRows,
        savePastedRows,
        normalizeRowData,
        projectNeedsToolsWrapper,
        toolNeedsChargeCodeWrapper
      ),
      [
        hotTableRef,
        wrappedSetTimesheetDraftData,
        onChange,
        saveTimersRef,
        pendingSaveRef,
        saveAndReloadRow,
      ]
    );
    const handleAfterBeginEditing = useHandleAfterBeginEditing(
      hotTableRef,
      wrappedSetValidationErrors
    );
    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const applyMacro = useCallback(
      createApplyMacro(
        hotTableRef,
        wrappedSetTimesheetDraftData,
        onChange,
        macros,
        isMacroEmpty,
        normalizeRowData,
        projectNeedsToolsWrapper,
        toolNeedsChargeCodeWrapper
      ),
      [
        hotTableRef,
        wrappedSetTimesheetDraftData,
        onChange,
        macros,
        isMacroEmpty,
        normalizeRowData,
        projectNeedsToolsWrapper,
        toolNeedsChargeCodeWrapper,
      ]
    );

    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const duplicateSelectedRow = useCallback(
      createDuplicateSelectedRow(hotTableRef),
      [hotTableRef]
    );
    // Register custom shortcuts using Handsontable's built-in addShortcut() method
    useEffect(() => {
      registerTimesheetShortcuts(hotTableRef, applyMacro, duplicateSelectedRow);
      // Cleanup is handled automatically by Handsontable when instance is destroyed
    }, [applyMacro, duplicateSelectedRow]);
    const handleSubmitTimesheet = useMemo(
      () =>
        createHandleSubmitTimesheet(
          isProcessingRef,
          setIsProcessing,
          isAdmin,
          token,
          timesheetDraftData,
          refreshTimesheetDraft,
          refreshArchiveData,
          submitTimesheet,
          logError,
          logWarn,
          logVerbose
        ),
      [
        isProcessingRef,
        setIsProcessing,
        isAdmin,
        token,
        timesheetDraftData,
        refreshTimesheetDraft,
        refreshArchiveData,
      ]
    );
    const handleStopSubmission = useMemo(
      () =>
        createHandleStopSubmission(
          isProcessingRef,
          setIsProcessing,
          refreshTimesheetDraft,
          refreshArchiveData,
          cancelTimesheetSubmission,
          logInfo,
          logWarn,
          logError
        ),
      [
        isProcessingRef,
        setIsProcessing,
        refreshTimesheetDraft,
        refreshArchiveData,
      ]
    );
    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const cellsFunction = useCallback(
      createCellsFunction(
        timesheetDraftData,
        weekdayPatternRef,
        getSmartPlaceholder,
        projectNeedsToolsWrapper,
        getToolsForProjectWrapper,
        toolNeedsChargeCodeWrapper
      ),
      [timesheetDraftData, weekdayPatternRef, getSmartPlaceholder]
    );
    
    

    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleBeforeKeyDown = useCallback(
      createHandleBeforeKeyDown(
        hotTableRef,
        timesheetDraftData,
        weekdayPatternRef,
        getSmartPlaceholder,
        incrementDate,
        formatDateForDisplay
      ),
      [
        hotTableRef,
        timesheetDraftData,
        weekdayPatternRef,
        getSmartPlaceholder,
        incrementDate,
        formatDateForDisplay,
      ]
    );
    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleAfterSelection = useCallback(
      createHandleAfterSelection(
        hotTableRef,
        previousSelectionRef,
        setValidationErrors
      ),
      [hotTableRef, previousSelectionRef, setValidationErrors]
    );
    
    // Column definitions - NO validators (validation happens in afterChange to prevent editor blocking)
    // CRITICAL: ID column must be first and hidden - this is the "Golden Rule" for Handsontable-SQL sync
    const columnDefinitions = useMemo(() => getColumnDefinitions(), []);
    
    // WHY: Memoize these props to prevent creating new object/array references on every render.
    // Creating new references causes Handsontable's React wrapper to detect prop changes and
    // call updateData repeatedly, triggering infinite update loops.
    const customBorders = useMemo(() => [], []);
    const contextMenuConfig = useMemo(() => ({ items: [...HOTTABLE_CONTEXT_MENU] }), []);
    const enterMovesConfig = useMemo(() => ({ row: 1, col: 0 }), []);
    const tabMovesConfig = useMemo(() => ({ row: 0, col: 1 }), []);
    
    // Track when data prop changes for HotTable
    const prevDataRef = useRef<TimesheetRow[]>(timesheetDraftData);
    const dataPropRef = useRef<TimesheetRow[]>(timesheetDraftData);
    
    useEffect(() => {
      const currentStr = JSON.stringify(timesheetDraftData);
      const prevStr = JSON.stringify(prevDataRef.current);
      const referenceChanged = timesheetDraftData !== prevDataRef.current;
      const contentChanged = currentStr !== prevStr;
      
      if (referenceChanged || contentChanged) {
        logVerbose("[TimesheetGrid] data prop for HotTable changed", {
          referenceChanged,
          contentChanged,
          currentLength: timesheetDraftData.length,
          prevLength: prevDataRef.current.length,
          stack: new Error().stack?.split('\n').slice(1, 6).join('\n'),
        });
        dataPropRef.current = timesheetDraftData;
      }
      prevDataRef.current = timesheetDraftData;
    }, [timesheetDraftData]);
    // Validate timesheet data for button status - MUST be before early returns
    const buttonStatus: ButtonStatus = useMemo(
      () => calculateButtonStatus(timesheetDraftData),
      [timesheetDraftData]
    );
    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleManualSave = useCallback(
      createHandleManualSave(
        saveButtonState,
        unsavedRowsRef,
        saveStartTimeRef,
        wrappedSetSaveButtonState,
        saveAndReloadRow,
        updateSaveButtonState
      ),
      [
        saveButtonState,
        unsavedRowsRef,
        saveStartTimeRef,
        wrappedSetSaveButtonState,
        saveAndReloadRow,
        updateSaveButtonState,
      ]
    );
    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleRefresh = useCallback(
      createHandleRefresh(
        wrappedSetTimesheetDraftData,
        logInfo,
        logWarn,
        logError,
        resetInProgressIpc,
        loadDraftIpc
      ),
      [wrappedSetTimesheetDraftData]
    );
    if (isTimesheetDraftLoading || timesheetDraftError) {
      return (
        <TimesheetGridLoadingState
          isLoading={isTimesheetDraftLoading}
          error={timesheetDraftError}
        />
      );
    }

    return (
      <div className="timesheet-page">
        <TimesheetGridHeader
          saveButtonState={saveButtonState}
          onSave={handleManualSave}
          isAdmin={isAdmin}
          archiveEntries={archiveData.timesheet}
        />
        <MacroToolbar
          macros={macros}
          onApplyMacro={applyMacro}
          onEditMacros={() => setShowMacroDialog(true)}
        />
        <HotTable
          ref={hotTableRef}
          id="sheetpilot-timesheet-grid"
          data={timesheetDraftData}
          columns={columnDefinitions}
          cells={cellsFunction}
          beforeRemoveRow={handleBeforeRemoveRow}
          afterChange={handleAfterChange}
          afterRemoveRow={handleAfterRemoveRow}
          beforePaste={handleBeforePaste}
          afterPaste={handleAfterPaste}
          afterBeginEditing={handleAfterBeginEditing}
          beforeKeyDown={handleBeforeKeyDown}
          afterSelection={handleAfterSelection}
          themeName="ht-theme-horizon"
          width="100%"
          rowHeaders={true}
          colHeaders={true}
          customBorders={customBorders}
          contextMenu={contextMenuConfig}
          manualColumnResize={true}
          manualRowResize={true}
          stretchH="all"
          licenseKey="non-commercial-and-evaluation"
          minSpareRows={1}
          readOnly={false}
          fillHandle={true}
          autoWrapRow={false}
          autoWrapCol={false}
          fragmentSelection={true}
          disableVisualSelection={false}
          selectionMode="range"
          outsideClickDeselects={true}
          viewportRowRenderingOffset={24}
          columnSorting={HOTTABLE_COLUMN_SORTING}
          tabNavigation={true}
          navigableHeaders={true}
          copyPaste={true}
          search={true}
          enterMoves={enterMovesConfig}
          tabMoves={tabMovesConfig}
          invalidCellClassName="htInvalid"
        />
        <TimesheetGridFooter
          validationErrors={validationErrors}
          onShowAllErrors={() => setShowErrorDialog(true)}
          onRefresh={handleRefresh}
          buttonStatus={buttonStatus}
          onSubmit={handleSubmitTimesheet}
          isSubmitting={isProcessing}
          onStop={handleStopSubmission}
          isAdmin={isAdmin}
          isLoading={isTimesheetDraftLoading}
        />
        {/* Validation Error Dialog */}
        <ValidationErrorDialog
          open={showErrorDialog}
          errors={validationErrors}
          onClose={() => setShowErrorDialog(false)}
        />
        {/* Macro Manager Dialog */}
        <MacroManagerDialog
          open={showMacroDialog}
          onClose={() => setShowMacroDialog(false)}
          onSave={(savedMacros) => {
            setMacros(savedMacros);
            window.logger?.info("Macros updated", {
              count: savedMacros.filter((m) => !isMacroEmpty(m)).length,
            });
          }}
        />
        {/* Keyboard Shortcuts Hint Dialog */}
        <KeyboardShortcutsHintDialog
          open={showShortcutsHint}
          onClose={() => setShowShortcutsHint(false)}
        />
      </div>
    );
  }
);

// Wrap with React.memo to prevent unnecessary re-renders
export default memo(TimesheetGrid);
