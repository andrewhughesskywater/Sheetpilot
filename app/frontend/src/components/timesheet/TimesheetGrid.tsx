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
import { loadMacros, isMacroEmpty } from "@/utils/macroStorage";
import type { ValidationError } from "./cell-processing/timesheet.cell-processing";

type ButtonStatus = "neutral" | "ready" | "warning";

/**
 * Date picker options interface for Handsontable date editor
 */
interface DatePickerOptions {
  onSelect?: (this: DatePickerOptions, date: Date) => void;
  [key: string]: unknown;
}

/**
 * Date editor interface for Handsontable date editor
 * Extends the base editor with date picker specific properties
 */
interface DateEditor {
  $datePicker?: {
    _o?: DatePickerOptions;
  };
  isOpened?: () => boolean;
  finishEditing: (restoreOriginalValue: boolean, ctrlDown: boolean) => void;
}

import { normalizeRowData } from "./schema/timesheet.schema";
import {
  getToolsForProject,
  doesToolNeedChargeCode,
  doesProjectNeedTools,
} from "@sheetpilot/shared/business-config";
import { getColumnDefinitions } from "./column-config/timesheet.column-config";
import { validateTimesheetRows } from "./validation/timesheet.validation";
import { submitTimesheet } from "./submit/timesheet.submit";
import {
  batchSaveToDatabase as batchSaveToDatabaseUtil,
  saveRowToDatabase,
} from "./persistence/timesheet.persistence";
import { SpellcheckEditor } from "./editors/SpellcheckEditor";
import {
  detectWeekdayPattern,
  getSmartPlaceholder,
  incrementDate,
  formatDateForDisplay,
} from "@/utils/smartDate";
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

// Register all Handsontable modules
registerAllModules();

// Register custom spellcheck editor
registerEditor("spellcheckText", SpellcheckEditor);

// Wrapper functions to match expected signatures
const projectNeedsToolsWrapper = (p?: string) => doesProjectNeedTools(p || "");
const toolNeedsChargeCodeWrapper = (t?: string) =>
  doesToolNeedChargeCode(t || "");
const getToolsForProjectWrapper = (project: string) => [
  ...getToolsForProject(project),
];

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

    const updateTableData = useCallback(
      (newData: TimesheetRow[]) => {
        if (hotTableRef.current?.hotInstance) {
          requestAnimationFrame(() => {
            window.logger?.debug(
              "[TimesheetGrid] Updating table data while preserving state"
            );
            hotTableRef.current?.hotInstance?.updateData(newData);
          });
        }
        onChange?.(newData);
      },
      [onChange]
    );

    const isInitialLoadRef = useRef(true);
    const isProcessingChangeRef = useRef(false);
    const previousDataRef = useRef<TimesheetRow[]>(timesheetDraftData);
    useEffect(() => {
      if (isProcessingChangeRef.current) {
        return;
      }

      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        previousDataRef.current = timesheetDraftData;
        onChange?.(timesheetDraftData);
      } else if (timesheetDraftData && hotTableRef.current?.hotInstance) {
        const dataChanged =
          previousDataRef.current.length !== timesheetDraftData.length ||
          JSON.stringify(previousDataRef.current.slice(0, 3)) !==
            JSON.stringify(timesheetDraftData.slice(0, 3));

        if (dataChanged) {
          previousDataRef.current = timesheetDraftData;
          updateTableData(timesheetDraftData);
        }
      }
    }, [timesheetDraftData, updateTableData, onChange]);
    useEffect(() => {
      const loaded = loadMacros();
      setMacros(loaded);
    }, []);

    useEffect(() => {
      if (timesheetDraftData && timesheetDraftData.length > 0) {
        weekdayPatternRef.current = detectWeekdayPattern(timesheetDraftData);
      }
    }, [timesheetDraftData]);

    /**
     * WHY: MUI Dialog modifies body overflow which breaks Handsontable scrollbar.
     * Force layout recalculation after dialog closes to restore scrollbar visibility.
     */
    useEffect(() => {
      if (showMacroDialog) return;

      const hotInstance = hotTableRef.current?.hotInstance;
      if (!hotInstance) return;

      const timer = setTimeout(() => {
        if (document.body.style.overflow === "hidden") {
          document.body.style.overflow = "";
        }
        window.dispatchEvent(new Event("resize"));
        hotInstance.render();
      }, 100);

      return () => clearTimeout(timer);
    }, [showMacroDialog]);
    const batchSaveToDatabase = useCallback(async () => {
      await batchSaveToDatabaseUtil(timesheetDraftData);
    }, [timesheetDraftData]);

    // Expose batch save function to parent component via ref
    useImperativeHandle(
      ref,
      () => ({
        batchSaveToDatabase,
      }),
      [batchSaveToDatabase]
    );

    useEffect(() => {
      const saveTimers = saveTimersRef.current;
      const pendingSaves = pendingSaveRef.current;
      const inFlightSaves = inFlightSavesRef.current;

      return () => {
        window.logger?.info(
          "[TimesheetGrid] Component unmounting, flushing pending saves"
        );

        inFlightSaves.forEach((controller) => {
          controller.abort();
        });
        inFlightSaves.clear();

        saveTimers.forEach((timer) => clearTimeout(timer));
        saveTimers.clear();

        const pendingRows = Array.from(pendingSaves.entries());
        for (const [rowIdx, row] of pendingRows) {
          saveRowToDatabase(row).catch((error) => {
            window.logger?.error("Could not flush pending save on unmount", {
              rowIdx,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
        pendingSaves.clear();
      };
    }, []);

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

    /**
     * WHY: Handsontable's strict validation blocks paste for Tool/Charge Code dropdowns
     * when values aren't in current dropdown source. We bypass this by allowing paste,
     * then manually applying Tool/Charge Code in afterPaste with relaxed validation.
     */
    const handleBeforePaste = useCallback(() => {
      return true;
    }, []);

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

    const handleAfterBeginEditing = useCallback(
      (row: number, column: number) => {
        setValidationErrors((prev) =>
          prev.filter((err) => !(err.row === row && err.col === column))
        );

        /**
         * WHY: Handsontable's date picker sometimes doesn't close after selection,
         * leaving the editor stuck open and blocking navigation. We override the
         * onSelect callback to forcibly close the editor after date selection.
         */
        if (column === 0) {
          const hotInstance = hotTableRef.current?.hotInstance;
          const editor = hotInstance?.getActiveEditor();
          if (editor) {
            const dateEditor = editor as DateEditor;
            if (dateEditor.$datePicker && dateEditor.$datePicker._o) {
              const originalOnSelect = dateEditor.$datePicker._o.onSelect;
              // WHY: 'this' context must be preserved for picker's internal state management

              dateEditor.$datePicker._o.onSelect = function (
                this: DatePickerOptions,
                date: Date
              ) {
                if (originalOnSelect) originalOnSelect.call(this, date);
                setTimeout(() => {
                  if (dateEditor.isOpened && dateEditor.isOpened()) {
                    dateEditor.finishEditing(false, false);
                  }
                }, 50);
              };
            }
          }
        }
      },
      []
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
      const hotInstance = hotTableRef.current?.hotInstance;
      if (!hotInstance) return;

      const gridContext = hotInstance.getShortcutManager().getContext("grid");

      // Register macro shortcuts (Ctrl+1-5)
      for (let i = 1; i <= 5; i++) {
        gridContext.addShortcut({
          keys: [["Ctrl", i.toString()]],
          callback: () => {
            const macroIndex = i - 1;
            applyMacro(macroIndex);
          },
          group: "timesheet-macros",
        });
      }

      // Register duplicate row shortcut (Ctrl+D)
      gridContext.addShortcut({
        keys: [["Ctrl", "d"]],
        callback: () => {
          duplicateSelectedRow();
        },
        group: "timesheet-actions",
      });

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
    const buttonStatus: ButtonStatus = useMemo(() => {
      if (!timesheetDraftData || timesheetDraftData.length === 0) {
        return "neutral";
      }

      const validation = validateTimesheetRows(timesheetDraftData);

      // Log validation errors for debugging
      if (validation.hasErrors) {
        window.logger?.warn("Timesheet validation errors detected", {
          errorCount: validation.errorDetails.length,
          errors: validation.errorDetails,
        });
        return "warning";
      }

      window.logger?.debug(
        "All timesheet validations passed - button is ready"
      );
      return "ready";
    }, [timesheetDraftData]);

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
          contextMenu={[
            "row_above",
            "row_below",
            "remove_row",
            "---------",
            "undo",
            "redo",
            "---------",
            "copy",
            "cut",
          ]}
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
          columnSorting={{
            indicator: true,
            headerAction: true,
            sortEmptyCells: true,
          }}
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
