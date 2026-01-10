import type { HotTableRef } from '@handsontable/react-wrapper';
import type { MutableRefObject } from 'react';
import { useCallback, useState } from 'react';

import type { MacroRow } from '../../../utils/macroStorage';
import { isMacroEmpty, loadMacros } from '../../../utils/macroStorage';
import type { TimesheetRow } from '../timesheet.schema';

interface UseMacroSystemParams {
  hotTableRef?: MutableRefObject<HotTableRef | null>;
  timesheetDraftData?: TimesheetRow[];
  setTimesheetDraftData?: (rows: TimesheetRow[]) => void;
}

/**
 * Gets the HotTable instance from the ref
 */
function getHotTableInstance(ref?: MutableRefObject<HotTableRef | null>) {
  if (!ref?.current) return null;
  return ref.current.hotInstance ?? ref.current;
}

/**
 * Determines the row index from HotTable selection
 */
function getSelectedRow(hotTable: HotTableRef): number | undefined {
  const lastSelection = hotTable.getSelectedLast?.();
  const selected = lastSelection ?? hotTable.getSelected?.()?.[0];

  let row: number | undefined;
  if (Array.isArray(selected)) {
    row = selected[0] as number | undefined;
  }

  if (typeof row === 'number' && !Number.isNaN(row)) {
    return row;
  }

  const range = hotTable.getSelectedRangeLast?.();
  const rangeRow = range?.from?.row ?? range?.to?.row;
  if (typeof rangeRow === 'number' && !Number.isNaN(rangeRow)) {
    return rangeRow;
  }

  return undefined;
}

/**
 * Creates new row data with macro values applied
 */
function createMacroAppliedRow(
  macro: MacroRow,
  currentRow: TimesheetRow | undefined
): TimesheetRow {
  return {
    ...currentRow,
    timeIn: macro.timeIn || currentRow?.timeIn,
    timeOut: macro.timeOut || currentRow?.timeOut,
    project: macro.project || currentRow?.project,
    tool: macro.tool !== undefined ? macro.tool : currentRow?.tool,
    chargeCode: macro.chargeCode !== undefined ? macro.chargeCode : currentRow?.chargeCode,
    taskDescription: macro.taskDescription || currentRow?.taskDescription,
  };
}

/**
 * Extracts the first row number from selection array
 */
function getFirstRowFromSelection(selected?: (number | string)[][]): number | undefined {
  const firstSelection = selected?.[0];
  if (!Array.isArray(firstSelection)) return undefined;
  const row = firstSelection[0];
  return typeof row === 'number' ? row : undefined;
}

export function useMacroSystem(params?: UseMacroSystemParams) {
  // Use lazy initializer to load macros on first render without causing effect cascades
  const [macros, setMacros] = useState<MacroRow[]>(() => {
    try {
      return loadMacros();
    } catch {
      return [];
    }
  });
  const [showMacroDialog, setShowMacroDialog] = useState(false);

  /**
   * Apply a macro to the currently selected row
   */
  const applyMacro = useCallback(
    (index: number): void => {
      const macro = macros[index];
      if (!macro || isMacroEmpty(macro)) {
        window.logger?.warn('Macro is empty or not configured', { macroIndex: index });
        return;
      }

      const hotTable = getHotTableInstance(params?.hotTableRef);
      if (!hotTable) {
        window.logger?.warn('HotTable reference not available');
        return;
      }

      const row = getSelectedRow(hotTable);
      if (typeof row !== 'number') {
        window.logger?.warn('No cell selected');
        return;
      }

      if (!params?.timesheetDraftData || !params?.setTimesheetDraftData) {
        return;
      }

      // Create new row data with macro values
      const newData = [...params.timesheetDraftData];
      newData[row] = createMacroAppliedRow(macro, newData[row]);

      params.setTimesheetDraftData(newData);
      window.logger?.info('Macro applied', { macroIndex: index, row });
    },
    [macros, params]
  );

  const duplicateSelectedRow = useCallback((): void => {
    const hotTable = getHotTableInstance(params?.hotTableRef);
    if (!hotTable || !params?.timesheetDraftData || !params?.setTimesheetDraftData) {
      return;
    }

    const selected = hotTable.getSelected?.();
    const row = getFirstRowFromSelection(selected);
    if (typeof row !== 'number') {
      window.logger?.warn('No row selected to duplicate');
      return;
    }

    const rowToDuplicate = params.timesheetDraftData[row];
    if (!rowToDuplicate) {
      return;
    }

    const newData = [...params.timesheetDraftData];
    newData.splice(row + 1, 0, { ...rowToDuplicate, id: undefined }); // Remove ID so it gets a new one
    params.setTimesheetDraftData(newData);
    window.logger?.info('Row duplicated', { sourceRow: row, newRow: row + 1 });
  }, [params]);

  const handleMacroKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      const hasShortcutModifier = event.ctrlKey || event.metaKey;
      if (!hasShortcutModifier) return false;

      const num = Number(event.key);
      if (Number.isInteger(num) && num >= 1 && num <= 5) {
        applyMacro(num - 1);
        event.preventDefault();
        return true;
      }

      return false;
    },
    [applyMacro]
  );

  return {
    macros,
    setMacros,
    showMacroDialog,
    setShowMacroDialog,
    applyMacro,
    duplicateSelectedRow,
    handleMacroKeyDown,
  } as const;
}
