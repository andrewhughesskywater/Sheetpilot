import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { HotTableRef } from '@handsontable/react-wrapper';
import type { TimesheetRow } from '../timesheet.schema';

export function useBeforeKeyDownHandler() {
  interface ComputeDateInsertConfig {
    beforeKeyEvent: KeyboardEvent;
    timesheetDraftData: TimesheetRow[];
    selectedRows: Set<number>;
    hotRef: RefObject<HotTableRef | null>;
  }

  const computeDateInsert = useCallback(
    (config: ComputeDateInsertConfig): void => {
      const { beforeKeyEvent, timesheetDraftData, selectedRows, hotRef } = config;
      if (!beforeKeyEvent.shiftKey) return;

      const selectedRowArray = Array.from(selectedRows).sort((a, b) => a - b);
      if (selectedRowArray.length === 0) return;

      const firstSelectedRow = selectedRowArray[0];
      const referenceRow = timesheetDraftData[firstSelectedRow];
      if (!referenceRow?.date) return;

      const referenceDate = new Date(referenceRow.date);
      const adjustedDate = new Date(referenceDate);
      adjustedDate.setDate(adjustedDate.getDate() + 1);

      const hotInstance = hotRef.current?.hotInstance;
      if (!hotInstance) return;

      // Populate date column for all selected rows with incremented dates
      const currentDate = new Date(referenceDate);
      for (const rowIdx of selectedRowArray) {
        currentDate.setDate(currentDate.getDate() + 1);
        const dateStr = currentDate.toISOString().split('T')[0];
        hotInstance.setDataAtCell(rowIdx, 0, dateStr);
      }

      window.logger?.verbose('Applied date increment to selected rows', {
        count: selectedRowArray.length,
        baseDate: referenceRow.date
      });
    },
    []
  );

  interface HandleBeforeKeyDownConfig {
    event: KeyboardEvent;
    timesheetDraftData: TimesheetRow[];
    selectedRows: Set<number>;
    hotRef: RefObject<HotTableRef | null>;
    handleMacroKeyDown: (event: KeyboardEvent) => boolean;
  }

  const handleBeforeKeyDown = useCallback(
    (config: HandleBeforeKeyDownConfig): boolean => {
      const { event, timesheetDraftData, selectedRows, hotRef, handleMacroKeyDown } = config;
      if (event.shiftKey && event.key === 'ArrowDown') {
        computeDateInsert({ beforeKeyEvent: event, timesheetDraftData, selectedRows, hotRef });
        return false;
      }

      // Check for macro keys
      const isMacroHandled = handleMacroKeyDown(event);
      if (isMacroHandled) {
        event.preventDefault();
        return false;
      }

      return true;
    },
    [computeDateInsert]
  );

  return { handleBeforeKeyDown, computeDateInsert };
}
