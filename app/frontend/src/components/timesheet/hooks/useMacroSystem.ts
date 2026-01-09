import type { HotTableRef } from '@handsontable/react-wrapper';
import type { MutableRefObject } from 'react';
import { useCallback,useState } from 'react';

import type { MacroRow } from '../../../utils/macroStorage';
import { isMacroEmpty,loadMacros } from '../../../utils/macroStorage';
import type { TimesheetRow } from '../timesheet.schema';

interface UseMacroSystemParams {
  hotTableRef?: MutableRefObject<HotTableRef | null>;
  timesheetDraftData?: TimesheetRow[];
  setTimesheetDraftData?: (rows: TimesheetRow[]) => void;
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
   * Fills in the selected row with macro data
   */
  const applyMacro = useCallback(
    (index: number) => {
      const macro = macros[index];
      if (!macro || isMacroEmpty(macro)) {
        window.logger?.warn('Macro is empty or not configured', { macroIndex: index });
        return;
      }

      const hotTable = params?.hotTableRef?.current?.hotInstance ?? params?.hotTableRef?.current;
      if (!hotTable) {
        window.logger?.warn('HotTable reference not available');
        return;
      }

      // Get the currently selected cell
      const lastSelection = hotTable.getSelectedLast?.();
      const selected = lastSelection ?? hotTable.getSelected?.()?.[0];

      let row: number | undefined;
      if (Array.isArray(selected)) {
        row = selected[0] as number | undefined;
      }

      if (typeof row !== 'number' || Number.isNaN(row)) {
        const range = hotTable.getSelectedRangeLast?.();
        row = range?.from?.row ?? range?.to?.row;
      }

      if (typeof row !== 'number' || Number.isNaN(row)) {
        window.logger?.warn('No cell selected');
        return;
      }

      if (!params?.timesheetDraftData || !params?.setTimesheetDraftData) {
        return;
      }

      // Create new row data with macro values
      const newData = [...params.timesheetDraftData];
      newData[row] = {
        ...newData[row],
        timeIn: macro.timeIn || newData[row]?.timeIn,
        timeOut: macro.timeOut || newData[row]?.timeOut,
        project: macro.project || newData[row]?.project,
        tool: macro.tool !== undefined ? macro.tool : newData[row]?.tool,
        chargeCode: macro.chargeCode !== undefined ? macro.chargeCode : newData[row]?.chargeCode,
        taskDescription: macro.taskDescription || newData[row]?.taskDescription,
      };

      params.setTimesheetDraftData(newData);
      window.logger?.info('Macro applied', { macroIndex: index, row });
    },
    [macros, params]
  );

  const duplicateSelectedRow = useCallback(() => {
    const hotTable = params?.hotTableRef?.current;
    if (!hotTable || !params?.timesheetDraftData || !params?.setTimesheetDraftData) {
      return;
    }

    const selected = hotTable.getSelected?.();
    if (!selected || selected.length === 0) {
      window.logger?.warn('No row selected to duplicate');
      return;
    }

    const [row] = selected[0] ?? [];
    if (typeof row !== 'number') {
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
