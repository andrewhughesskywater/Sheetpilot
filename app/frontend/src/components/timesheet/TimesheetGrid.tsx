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

import { useCallback, useImperativeHandle, forwardRef, memo } from 'react';
import { registerAllModules } from 'handsontable/registry';
import { registerEditor } from 'handsontable/editors';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-horizon.css';
import { useTimesheetOrchestrator } from './hooks/useTimesheetOrchestrator';
import './TimesheetGrid.css';
import type { TimesheetRow } from './timesheet.schema';
import MacroManagerDialog from './MacroManagerDialog';
import KeyboardShortcutsHintDialog from '../KeyboardShortcutsHintDialog';
import { ValidationErrorDialog } from './ValidationErrorDialog';
import { MacroToolbar } from './presentational/MacroToolbar';
import { TimesheetHeader } from './presentational/TimesheetHeader';
import { TimesheetHotTable } from './presentational/TimesheetHotTable';
import { TimesheetFooter } from './presentational/TimesheetFooter';

//

// Handsontable-related helper types and functions are imported from utils

import { batchSaveToDatabase as batchSaveToDatabaseUtil } from './timesheet.persistence';
import { SpellcheckEditor } from './SpellcheckEditor';
// Orchestrator composes sub-orchestrators and exposes the model

// Register all Handsontable modules
registerAllModules();

// Register custom spellcheck editor
registerEditor('spellcheckText', SpellcheckEditor);

// TimesheetGrid orchestrates sub-orchestrators and presentational components.

// Helpers and validators were moved to utils/timesheetGridUtils

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
const TimesheetGrid = forwardRef<TimesheetGridHandle, TimesheetGridProps>(function TimesheetGrid({ onChange }, ref) {
  const {
    hotTableRef,
    timesheetDraftData,
    isTimesheetDraftLoading,
    timesheetDraftError,
    saveButtonState,
    handleManualSave,
    isAdmin,
    macros,
    showMacroDialog,
    setShowMacroDialog,
    applyMacro,
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
  } = useTimesheetOrchestrator(onChange);

  const batchSaveToDatabase = useCallback(async () => {
    await batchSaveToDatabaseUtil(timesheetDraftData);
  }, [timesheetDraftData]);

  useImperativeHandle(ref, () => ({ batchSaveToDatabase }), [batchSaveToDatabase]);

  if (isTimesheetDraftLoading) {
    return (
      <div className="timesheet-page">
        <h2 className="md-typescale-headline-medium">Timesheet</h2>
        <p className="md-typescale-body-large">Loading draft data...</p>
      </div>
    );
  }

  if (timesheetDraftError) {
    return (
      <div className="timesheet-page">
        <h2 className="md-typescale-headline-medium">Timesheet</h2>
        <p className="md-typescale-body-large timesheet-error-message">
          Error loading timesheet data: {timesheetDraftError}
        </p>
      </div>
    );
  }
  return (
    <div className="timesheet-page">
      <h2 className="md-typescale-headline-medium">Timesheet</h2>
      <TimesheetHeader saveButtonState={saveButtonState} onSave={handleManualSave} isAdmin={isAdmin} />
      <MacroToolbar macros={macros} onApplyMacro={applyMacro} onOpenManager={() => setShowMacroDialog(true)} />
      <TimesheetHotTable
        ref={hotTableRef}
        data={timesheetDraftData}
        columns={columnDefinitions}
        cells={cellsFunction}
        handlers={{
          beforeRemoveRow: handleBeforeRemoveRow,
          afterChange: handleAfterChange,
          afterRemoveRow: handleAfterRemoveRow,
          beforePaste: handleBeforePaste,
          afterPaste: handleAfterPaste,
          afterBeginEditing: handleAfterBeginEditing,
          beforeKeyDown: handleBeforeKeyDown,
          afterSelection: handleAfterSelection,
        }}
      />
      <TimesheetFooter
        validationErrors={validationErrors}
        onShowAllErrors={() => setShowErrorDialog(true)}
        isTimesheetDraftLoading={isTimesheetDraftLoading}
        onRefresh={onRefresh}
        onSubmit={handleSubmitTimesheet}
        isSubmitting={isProcessing}
        onStop={handleStopSubmission}
        isAdmin={isAdmin}
        buttonStatus={buttonStatus}
      />

      <ValidationErrorDialog open={showErrorDialog} errors={validationErrors} onClose={() => setShowErrorDialog(false)} />
      <MacroManagerDialog
        open={showMacroDialog}
        onClose={() => setShowMacroDialog(false)}
        onSave={(savedMacros) => {
          setMacros(savedMacros);
          window.logger?.info('Macros updated', { count: savedMacros.filter((m) => m && Object.keys(m).length).length });
        }}
      />
      <KeyboardShortcutsHintDialog open={showShortcutsHint} onClose={() => setShowShortcutsHint(false)} />
    </div>
  );
});

// Wrap with React.memo to prevent unnecessary re-renders
export default memo(TimesheetGrid);

