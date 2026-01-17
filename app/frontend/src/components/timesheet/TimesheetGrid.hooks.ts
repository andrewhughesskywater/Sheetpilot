/**
 * Custom hooks for TimesheetGrid component
 */

import React, { useEffect, useRef, useCallback } from "react";
import type { HotTableRef } from "@handsontable/react-wrapper";
import type { TimesheetRow } from "./schema/timesheet.schema";
import { loadMacros } from "@/utils/macroStorage";
import { detectWeekdayPattern } from "@/utils/smartDate";
import { saveRowToDatabase } from "./persistence/timesheet.persistence";
import { batchSaveToDatabase as batchSaveToDatabaseUtil } from "./persistence/timesheet.persistence";
import type { DateEditor } from "./TimesheetGrid.types";

/**
 * Hook to load macros on mount
 */
export function useLoadMacros(setMacros: (macros: unknown[]) => void): void {
  const setMacrosRef = useRef(setMacros);
  
  // Keep ref in sync without triggering effects
  React.useLayoutEffect(() => {
    setMacrosRef.current = setMacros;
  }, [setMacros]);
  
  useEffect(() => {
    const loaded = loadMacros();
    setMacrosRef.current(loaded);
  }, []); // Only run once on mount
}

/**
 * Hook to detect weekday pattern from timesheet data
 */
export function useWeekdayPattern(
  timesheetDraftData: TimesheetRow[],
  weekdayPatternRef: React.MutableRefObject<boolean>
): void {
  // WHY: weekdayPatternRef is a ref, so it doesn't need to be in the dependency array.
  // Refs are stable and don't cause re-renders when their current value changes.
  // Including it in deps is harmless but unnecessary - removing for clarity.
  useEffect(() => {
    if (timesheetDraftData && timesheetDraftData.length > 0) {
      weekdayPatternRef.current = detectWeekdayPattern(timesheetDraftData);
    }
  }, [timesheetDraftData]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Hook to fix Handsontable scrollbar after dialog closes
 */
export function useDialogScrollbarFix(
  showMacroDialog: boolean,
  hotTableRef: React.RefObject<HotTableRef | null>
): void {
  useEffect(() => {
    if (showMacroDialog) return;

    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    const timer = setTimeout(() => {
      if (document.body.style.overflow === "hidden") {
        document.body.style.overflow = "";
      }
      window.dispatchEvent(new Event("resize"));
      const isDestroyed =
        typeof (hotInstance as { isDestroyed?: () => boolean }).isDestroyed ===
        "function"
          ? (hotInstance as { isDestroyed: () => boolean }).isDestroyed()
          : false;
      if (isDestroyed) {
        return;
      }
      hotInstance.render();
    }, 100);

    return () => clearTimeout(timer);
  }, [showMacroDialog, hotTableRef]);
}

/**
 * Hook to flush pending saves on unmount
 */
export function useFlushPendingSavesOnUnmount(
  saveTimersRef: React.MutableRefObject<
    Map<number, ReturnType<typeof setTimeout>>
  >,
  pendingSaveRef: React.MutableRefObject<Map<number, TimesheetRow>>,
  inFlightSavesRef: React.MutableRefObject<Map<number, AbortController>>
): void {
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
  }, [saveTimersRef, pendingSaveRef, inFlightSavesRef]);
}

/**
 * Hook to sync timesheet data with Handsontable instance
 *
 * Relies on HotTable's built-in prop handling for data updates,
 * not imperative updateData() calls which can trigger infinite loops.
 */
export function useSyncTimesheetData(
  timesheetDraftData: TimesheetRow[],
  hotTableRef: React.RefObject<HotTableRef | null>,
  onChange?: (rows: TimesheetRow[]) => void
): void {
  const isInitialLoadRef = useRef(true);
  const onChangeRef = useRef(onChange);
  const prevDataRef = useRef<string>("");

  // Keep onChange ref in sync without triggering effects
  React.useLayoutEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const currentDataStr = JSON.stringify(timesheetDraftData);
    const dataChanged = currentDataStr !== prevDataRef.current;
    
    window.logger?.verbose("[TimesheetGrid] useSyncTimesheetData: effect triggered", {
      isInitialLoad: isInitialLoadRef.current,
      dataChanged,
      dataLength: timesheetDraftData.length,
      prevDataLength: prevDataRef.current ? JSON.parse(prevDataRef.current).length : 0,
    });
    
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      prevDataRef.current = currentDataStr;
      window.logger?.verbose("[TimesheetGrid] useSyncTimesheetData: initial load, calling onChange");
      onChangeRef.current?.(timesheetDraftData);
    } else if (dataChanged) {
      prevDataRef.current = currentDataStr;
      window.logger?.verbose("[TimesheetGrid] useSyncTimesheetData: data changed after initial load (unexpected)");
    }
  }, [timesheetDraftData]);
}

/**
 * Hook to create batch save to database callback
 */
export function useBatchSaveToDatabase(
  timesheetDraftData: TimesheetRow[]
): () => Promise<void> {
  return useCallback(async () => {
    await batchSaveToDatabaseUtil(timesheetDraftData);
  }, [timesheetDraftData]);
}

/**
 * Hook to create handleBeforePaste callback
 */
export function useHandleBeforePaste(): () => boolean {
  return useCallback(() => {
    return true;
  }, []);
}

/**
 * Hook to create handleAfterBeginEditing callback
 */
export function useHandleAfterBeginEditing<
  T extends { row: number; col: number }
>(
  hotTableRef: React.RefObject<HotTableRef | null>,
  setValidationErrors: React.Dispatch<React.SetStateAction<T[]>>
): (row: number, column: number) => void {
  return useCallback(
    (row: number, column: number) => {
      setValidationErrors(
        (prev) =>
          prev.filter((err) => !(err.row === row && err.col === column)) as T[]
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
            const pickerOptions = dateEditor.$datePicker._o;
            const originalOnSelect = pickerOptions.onSelect;
            // WHY: 'this' context must be preserved for picker's internal state management
            pickerOptions.onSelect = function (date: Date) {
              if (originalOnSelect) {
                originalOnSelect.call(pickerOptions, date);
              }
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
    [hotTableRef, setValidationErrors]
  );
}
