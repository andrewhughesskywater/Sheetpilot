import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { HotTableRef } from '@handsontable/react-wrapper';
import type { ValidationError } from '../utils/timesheetGridUtils';
import { PluginRegistry } from '../../../../../shared/plugin-registry';
import type { TimesheetUIPlugin } from '../../../../../shared/plugin-types';
import { TIMESHEET_PLUGIN_NAMESPACES } from '../../../../../shared/plugin-types';

interface TableHandlersConfig<T> {
  timesheetDraftData: T[];
  setTimesheetDraftData: (rows: T[]) => void;
  onChange: ((rows: T[]) => void) | undefined;
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
}

export function useTableHandlers<T>(config: TableHandlersConfig<T>) {
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
    updateSaveButtonState: _updateSaveButtonState
  } = config;
  const weekdayPatternRef = useRef<string | null>(null);
  const previousSelectionRef = useRef<[number, number, number, number] | null>(null);

  const handleAfterChange = () => {};
  const handleAfterRemoveRow = () => {};
  const handleBeforeRemoveRow = () => {};
  const handleBeforePaste = () => {};
  const handleAfterPaste = () => {};
  const handleAfterBeginEditing = () => {};
  const handleBeforeKeyDown = () => {};
  const handleAfterSelection = () => {};

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
