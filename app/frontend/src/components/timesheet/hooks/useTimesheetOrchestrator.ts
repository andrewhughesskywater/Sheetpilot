import type { HotTableRef } from '@handsontable/react-wrapper';
import type { MutableRefObject } from 'react';
import { useMemo, useRef, useState } from 'react';

import { useData } from '../../../contexts/DataContext';
import { useSession } from '../../../contexts/SessionContext';
import type { MacroRow } from '../../../utils/macroStorage';
import type { TimesheetRow } from '../timesheet.schema';
import { createRefreshHandler } from '../utils/refreshHelpers';
import type { ValidationError } from '../utils/timesheetGridUtils';
import { useCleanupOnUnmount } from './useCleanupOnUnmount';
import { useInitializeMacros } from './useInitializeMacros';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useMacroSystem } from './useMacroSystem';
import { type SaveState,useSaveState } from './useSaveState';
import { useScrollbarFix } from './useScrollbarFix';
import { useTableHandlers } from './useTableHandlers';
import { useTimesheetSubmission } from './useTimesheetSubmission';
import { useValidationState } from './useValidationState';
import { useWeekdayPatternDetection } from './useWeekdayPatternDetection';

// Handsontable event handler types
type BeforeRemoveRowHandler = (index: number, amount: number) => void;
type AfterChangeHandler = (changes: Array<[number, string | number, unknown, unknown]> | null, source: string) => void;
type AfterRemoveRowHandler = (index: number, amount: number) => void;
type BeforePasteHandler = (data: unknown[][], coords: unknown[]) => boolean | void;
type AfterPasteHandler = (data: unknown[][], coords: unknown[]) => void;
type AfterBeginEditingHandler = (row: number, col: number) => void;
type BeforeKeyDownHandler = (event: KeyboardEvent) => boolean | void;
type AfterSelectionHandler = (row: number, col: number, row2: number, col2: number) => void;

export interface TimesheetOrchestratorModel {
  hotTableRef: MutableRefObject<HotTableRef | null>;
  timesheetDraftData: TimesheetRow[];
  isTimesheetDraftLoading: boolean;
  timesheetDraftError: string | null | undefined;
  setTimesheetDraftData: (rows: TimesheetRow[]) => void;

  // header
  saveButtonState: SaveState;
  handleManualSave: () => Promise<void>;
  isAdmin: boolean;

  // macros
  macros: MacroRow[];
  showMacroDialog: boolean;
  setShowMacroDialog: (open: boolean) => void;
  applyMacro: (index: number) => void;
  duplicateSelectedRow: () => void;

  // table
  columnDefinitions: Array<Record<string, unknown>> | undefined;
  cellsFunction: (row: number, col: number) => Record<string, unknown> | void;
  handleBeforeRemoveRow: BeforeRemoveRowHandler;
  handleAfterChange: AfterChangeHandler;
  handleAfterRemoveRow: AfterRemoveRowHandler;
  handleBeforePaste: BeforePasteHandler;
  handleAfterPaste: AfterPasteHandler;
  handleAfterBeginEditing: AfterBeginEditingHandler;
  handleBeforeKeyDown: BeforeKeyDownHandler;
  handleAfterSelection: AfterSelectionHandler;
  handleAfterColumnResize: (newSize: number, column: number, isDoubleClick: boolean) => void;
  handleAfterRowResize: (newSize: number, row: number, isDoubleClick: boolean) => void;
  savedRowHeight: number | null;

  // footer
  validationErrors: ValidationError[];
  showErrorDialog: boolean;
  setShowErrorDialog: (open: boolean) => void;
  onRefresh: () => Promise<void>;
  handleSubmitTimesheet: () => void | Promise<void>;
  isProcessing: boolean;
  handleStopSubmission: () => void;
  buttonStatus: 'neutral' | 'ready' | 'warning';

  // dialogs
  setMacros: (macros: MacroRow[]) => void;
  showShortcutsHint: boolean;
  setShowShortcutsHint: (open: boolean) => void;
}

export function useTimesheetOrchestrator(onChange?: (rows: TimesheetRow[]) => void): TimesheetOrchestratorModel {
  const { token, isAdmin } = useSession();
  const {
    timesheetDraftData,
    setTimesheetDraftData,
    isTimesheetDraftLoading,
    timesheetDraftError,
    refreshTimesheetDraft,
    refreshArchiveData,
  } = useData();

  const hotTableRef = useRef<HotTableRef | null>(null);

  const { isProcessing, handleSubmitTimesheet, handleStopSubmission } = useTimesheetSubmission({
    token: token ?? undefined,
    isAdmin,
    timesheetDraftData,
    refreshTimesheetDraft,
    refreshArchiveData,
  });

  const {
    macros,
    setMacros,
    showMacroDialog,
    setShowMacroDialog,
    applyMacro,
    duplicateSelectedRow,
    handleMacroKeyDown,
  } = useMacroSystem({
    hotTableRef,
    timesheetDraftData,
    setTimesheetDraftData,
  });

  const { validationErrors, setValidationErrors, showErrorDialog, setShowErrorDialog } = useValidationState();

  const {
    saveButtonState,
    setSaveButtonState,
    unsavedRowsRef,
    pendingSaveRef,
    saveTimersRef,
    inFlightSavesRef,
    updateSaveButtonState,
    handleManualSave,
    saveAndReloadRow,
  } = useSaveState<TimesheetRow>(timesheetDraftData, setTimesheetDraftData, onChange, hotTableRef);

  const {
    weekdayPatternRef,
    /* previousSelectionRef */ handleAfterChange,
    handleAfterRemoveRow,
    handleBeforeRemoveRow,
    handleBeforePaste,
    handleAfterPaste,
    handleAfterBeginEditing,
    handleBeforeKeyDown,
    handleAfterSelection,
    handleAfterColumnResize,
    handleAfterRowResize,
    savedRowHeight,
    cellsFunction,
    columnDefinitions,
  } = useTableHandlers({
    timesheetDraftData,
    setTimesheetDraftData,
    onChange,
    hotTableRef,
    validationErrors,
    setValidationErrors,
    saveButtonState,
    setSaveButtonState,
    unsavedRowsRef,
    pendingSaveRef,
    saveTimersRef,
    inFlightSavesRef,
    saveAndReloadRow,
    updateSaveButtonState,
    handleMacroKeyDown,
  });

  const onRefresh = useMemo(() => createRefreshHandler(setTimesheetDraftData), [setTimesheetDraftData]);

  // Lifecycle helpers
  useInitializeMacros();
  useWeekdayPatternDetection(timesheetDraftData, weekdayPatternRef);
  useScrollbarFix(showMacroDialog, hotTableRef);
  useCleanupOnUnmount(saveTimersRef, pendingSaveRef, inFlightSavesRef);
  useKeyboardShortcuts(applyMacro, duplicateSelectedRow);

  const [showShortcutsHint, setShowShortcutsHint] = useState(false);
  const buttonStatus: 'neutral' | 'ready' | 'warning' = validationErrors.length > 0 ? 'warning' : 'ready';

  return {
    hotTableRef,
    timesheetDraftData,
    isTimesheetDraftLoading,
    timesheetDraftError,
    setTimesheetDraftData,

    saveButtonState,
    handleManualSave,
    isAdmin,

    macros,
    showMacroDialog,
    setShowMacroDialog,
    applyMacro,
    duplicateSelectedRow,

    columnDefinitions,
    cellsFunction,
    handleBeforeRemoveRow,
    handleAfterChange,
    handleAfterRemoveRow,
    handleBeforePaste,
    handleAfterPaste,
    handleAfterBeginEditing,
    handleBeforeKeyDown,
    handleAfterSelection,
    handleAfterColumnResize,
    handleAfterRowResize,
    savedRowHeight,

    validationErrors,
    showErrorDialog,
    setShowErrorDialog,
    onRefresh,
    handleSubmitTimesheet,
    isProcessing,
    handleStopSubmission,
    buttonStatus,

    setMacros,
    showShortcutsHint,
    setShowShortcutsHint,
  };
}
