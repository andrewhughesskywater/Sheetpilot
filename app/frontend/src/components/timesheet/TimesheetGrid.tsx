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

    const isProcessingChangeRef = useRef(false);
    useSyncTimesheetData(timesheetDraftData, hotTableRef, onChange);
    useLoadMacros((macros) => setMacros(macros as MacroRow[]));
    useWeekdayPattern(timesheetDraftData, weekdayPatternRef);
    useDialogScrollbarFix(showMacroDialog, hotTableRef);

    // Load business config asynchronously and update column sources
    useEffect(() => {
      let isMounted = true;

      async function loadBusinessConfig() {
        try {
          const [projectsResult, chargeCodesResult] = await Promise.all([
            getAllProjectsAsync(),
            getAllChargeCodesAsync(),
          ]);

          if (!isMounted) return;

          // Update column sources if HotTable is available
          if (hotTableRef.current?.hotInstance) {
            const hot = hotTableRef.current.hotInstance;
            const columns = hot.getSettings().columns;

            if (Array.isArray(columns) && projectsResult.length > 0) {
              // Update project column (index 3)
              if (columns[3]) {
                columns[3].source = [...projectsResult];
                hot.updateSettings({ columns });
                logVerbose("Updated project column sources from database");
              }
            }

            if (Array.isArray(columns) && chargeCodesResult.length > 0) {
              // Update charge code column (index 5)
              if (columns[5]) {
                columns[5].source = [...chargeCodesResult];
                hot.updateSettings({ columns });
                logVerbose("Updated charge code column sources from database");
              }
            }
          }
        } catch (error) {
          logWarn(
            "Could not load business config from database, using static config",
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
        isMounted = false;
        clearTimeout(timer);
      };
    }, [logVerbose, logWarn]);
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
        setSaveButtonState
      ),
      [unsavedRowsRef, inFlightSavesRef, saveStartTimeRef, setSaveButtonState]
    );
    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const saveAndReloadRow = useCallback(
      createSaveAndReloadRow(
        hotTableRef,
        setTimesheetDraftData,
        onChange,
        updateSaveButtonState,
        inFlightSavesRef,
        unsavedRowsRef,
        pendingSaveRef
      ),
      [
        hotTableRef,
        setTimesheetDraftData,
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
        setTimesheetDraftData,
        onChange,
        isProcessingChangeRef,
        saveAndReloadRow,
        setValidationErrors,
        setSaveButtonState,
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
        setTimesheetDraftData,
        onChange,
        rowsPendingRemovalRef
      ),
      [
        hotTableRef,
        timesheetDraftData,
        setTimesheetDraftData,
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
        setTimesheetDraftData,
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
        setTimesheetDraftData,
        onChange,
        saveTimersRef,
        pendingSaveRef,
        saveAndReloadRow,
      ]
    );
    const handleAfterBeginEditing = useHandleAfterBeginEditing(
      hotTableRef,
      setValidationErrors
    );
    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const applyMacro = useCallback(
      createApplyMacro(
        hotTableRef,
        setTimesheetDraftData,
        onChange,
        macros,
        isMacroEmpty,
        normalizeRowData,
        projectNeedsToolsWrapper,
        toolNeedsChargeCodeWrapper
      ),
      [
        hotTableRef,
        setTimesheetDraftData,
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
        setSaveButtonState,
        saveAndReloadRow,
        updateSaveButtonState
      ),
      [
        saveButtonState,
        unsavedRowsRef,
        saveStartTimeRef,
        setSaveButtonState,
        saveAndReloadRow,
        updateSaveButtonState,
      ]
    );
    // WHY: Factory function dependencies are correctly listed - ESLint cannot statically analyze factory functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleRefresh = useCallback(
      createHandleRefresh(
        setTimesheetDraftData,
        logInfo,
        logWarn,
        logError,
        resetInProgressIpc,
        loadDraftIpc
      ),
      [setTimesheetDraftData]
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
          customBorders={[]}
          contextMenu={HOTTABLE_CONTEXT_MENU as any}
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
          enterMoves={{ row: 1, col: 0 }}
          tabMoves={{ row: 0, col: 1 }}
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
