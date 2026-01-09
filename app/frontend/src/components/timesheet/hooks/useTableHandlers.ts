import { useMemo, useRef, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { HotTableRef } from '@handsontable/react-wrapper';
import type { ValidationError } from '../utils/timesheetGridUtils';
import { PluginRegistry } from '../../../../../shared/plugin-registry';
import type { TimesheetUIPlugin } from '../../../../../shared/plugin-types';
import { TIMESHEET_PLUGIN_NAMESPACES } from '../../../../../shared/plugin-types';
import type { TimesheetRow } from '../timesheet.schema';
import { computeDateInsert } from '../utils/timesheetGridUtils';

interface TableHandlersConfig {
  timesheetDraftData: TimesheetRow[];
  setTimesheetDraftData: (rows: TimesheetRow[]) => void;
  onChange: ((rows: TimesheetRow[]) => void) | undefined;
  hotTableRef: MutableRefObject<HotTableRef | null>;
  validationErrors: ValidationError[];
  setValidationErrors: (v: ValidationError[]) => void;
  saveButtonState: 'neutral' | 'saving' | 'saved';
  setSaveButtonState: (s: 'neutral' | 'saving' | 'saved') => void;
  unsavedRowsRef: MutableRefObject<Set<number>>;
  pendingSaveRef: MutableRefObject<Map<number, unknown>>;
  saveTimersRef: MutableRefObject<Map<number, ReturnType<typeof setTimeout>>>;
  inFlightSavesRef: MutableRefObject<Map<number, AbortController>>;
  saveAndReloadRow: (rowIndex: number) => Promise<void>;
  updateSaveButtonState: (s: 'neutral' | 'saving' | 'saved') => void;
  handleMacroKeyDown?: (event: KeyboardEvent) => boolean;
}

export function useTableHandlers(config: TableHandlersConfig) {
  const {
    timesheetDraftData: _timesheetDraftData,
    setTimesheetDraftData: _setTimesheetDraftData,
    onChange: _onChange,
    hotTableRef: _hotTableRef,
    validationErrors: _validationErrors,
    setValidationErrors: _setValidationErrors,
    saveButtonState: _saveButtonState,
    setSaveButtonState: _setSaveButtonState,
    unsavedRowsRef: _unsavedRowsRef,
    pendingSaveRef: _pendingSaveRef,
    saveTimersRef: _saveTimersRef,
    inFlightSavesRef: _inFlightSavesRef,
    saveAndReloadRow: _saveAndReloadRow,
    updateSaveButtonState: _updateSaveButtonState,
    handleMacroKeyDown: _handleMacroKeyDown
  } = config;
  const weekdayPatternRef = useRef<boolean>(false);
  const previousSelectionRef = useRef<[number, number, number, number] | null>(null);

  const handleAfterChange = () => {};
  const handleAfterRemoveRow = () => {};
  const handleBeforeRemoveRow = () => {};
  const handleBeforePaste = () => {};
  const handleAfterPaste = () => {};
  const handleAfterBeginEditing = () => {};
  const handleBeforeKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const hotInstance = _hotTableRef.current?.hotInstance;
      if (!hotInstance) return true;

      // Handle macros first so we do not also trigger date shortcuts
      if (_handleMacroKeyDown?.(event)) {
        return false;
      }

      const selection = hotInstance.getSelectedLast?.();
      if (!selection || selection.length < 2) return true;

      const [row, col] = selection;
      const { dateToInsert, preventDefault } = computeDateInsert(event, {
        row,
        col,
        timesheetDraftData: _timesheetDraftData,
        weekdayPattern: weekdayPatternRef.current,
      });

      if (dateToInsert) {
        hotInstance.setDataAtCell(row, col, dateToInsert, 'smart-date-placeholder');

        if (row >= 0 && row < _timesheetDraftData.length) {
          const next = [..._timesheetDraftData];
          const current = next[row];
          if (current) {
            next[row] = { ...current, date: dateToInsert } as TimesheetRow;
            _setTimesheetDraftData(next);
            _onChange?.(next);
          }
        }
      }

      if (preventDefault || !!dateToInsert) {
        event.preventDefault();
        return false;
      }

      return true;
    },
    [_handleMacroKeyDown, _hotTableRef, _onChange, _setTimesheetDraftData, _timesheetDraftData]
  );
  const handleAfterSelection = useCallback((row: number, col: number, row2: number, col2: number) => {
    previousSelectionRef.current = [row, col, row2, col2];
  }, []);

  const uiPlugin = useMemo(() => {
    const registry = PluginRegistry.getInstance();
    return registry.getPlugin<TimesheetUIPlugin>(TIMESHEET_PLUGIN_NAMESPACES.ui);
  }, []);

  const cellsFunction = useMemo(() => {
    if (uiPlugin?.buildCellsMeta) {
      return uiPlugin.buildCellsMeta() as () => unknown;
    }
    return () => ({
      // Return empty meta to use default behavior
    });
  }, [uiPlugin]);

  const columnDefinitions = useMemo(() => {
    if (uiPlugin?.buildColumns) {
      return uiPlugin.buildColumns(_timesheetDraftData) as Array<Record<string, unknown>>;
    }
    // Let Handsontable infer columns from data by returning undefined
    return undefined as Array<Record<string, unknown>> | undefined;
  }, [uiPlugin, _timesheetDraftData]);

  return {
    weekdayPatternRef,
    previousSelectionRef,
    handleAfterChange,
    handleAfterRemoveRow,
    handleBeforeRemoveRow,
    handleBeforePaste,
    handleAfterPaste,
    handleAfterBeginEditing,
    handleBeforeKeyDown,
    handleAfterSelection,
    cellsFunction,
    columnDefinitions,
  } as const;
}
