import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { ValidationError } from '../utils/timesheetGridUtils';
import { PluginRegistry } from '../../../../../shared/plugin-registry';
import type { TimesheetUIPlugin } from '../../../../../shared/plugin-types';
import { TIMESHEET_PLUGIN_NAMESPACES } from '../../../../../shared/plugin-types';

export function useTableHandlers<T>(
  _timesheetDraftData: T[],
  _setTimesheetDraftData: (rows: T[]) => void,
  _onChange: ((rows: T[]) => void) | undefined,
  _hotTableRef: MutableRefObject<any>,
  _validationErrors: ValidationError[],
  _setValidationErrors: (v: ValidationError[]) => void,
  _saveButtonState: 'neutral' | 'saving' | 'saved',
  _setSaveButtonState: (s: 'neutral' | 'saving' | 'saved') => void,
  _unsavedRowsRef: MutableRefObject<Set<number>>,
  _pendingSaveRef: MutableRefObject<Map<number, unknown>>,
  _saveTimersRef: MutableRefObject<Map<number, any>>,
  _inFlightSavesRef: MutableRefObject<Map<number, AbortController>>,
  _saveAndReloadRow: (rowIndex: number) => Promise<void>,
  _updateSaveButtonState: (s: 'neutral' | 'saving' | 'saved') => void,
) {
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
      return uiPlugin.buildColumns(_timesheetDraftData) as unknown as any[];
    }
    // Let Handsontable infer columns from data by returning undefined
    return undefined as unknown as any[];
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
