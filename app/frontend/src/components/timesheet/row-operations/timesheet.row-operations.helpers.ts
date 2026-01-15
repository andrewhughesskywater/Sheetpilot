/**
 * Helper functions for row operations
 */

import type { TimesheetRow } from '@/components/timesheet/schema/timesheet.schema';
import type { MutableRefObject } from 'react';

type ButtonStatus = 'saved' | 'saving' | 'save';

/**
 * Handle in-flight save button state logic
 */
export function handleInFlightSaveButtonState(
  inFlightSavesRef: MutableRefObject<Map<number, AbortController>>,
  unsavedRowsRef: MutableRefObject<Map<number, TimesheetRow>>,
  saveStartTimeRef: MutableRefObject<number | null>,
  setSaveButtonState: (state: ButtonStatus) => void,
  updateSaveButtonState: () => void
): void {
  if (saveStartTimeRef.current === null) {
    saveStartTimeRef.current = Date.now();
    setSaveButtonState('saving');
  }
  
  const elapsed = Date.now() - (saveStartTimeRef.current || Date.now());
  const minDuration = 1000;
  
  if (elapsed >= minDuration) {
    const stillHasInFlight = inFlightSavesRef.current.size > 0;
    const stillHasUnsaved = unsavedRowsRef.current.size > 0;
    
    if (!stillHasInFlight && !stillHasUnsaved) {
      setSaveButtonState('saved');
      saveStartTimeRef.current = null;
    } else if (!stillHasInFlight && stillHasUnsaved) {
      setSaveButtonState('save');
      saveStartTimeRef.current = null;
    }
  } else {
    const remaining = minDuration - elapsed;
    setTimeout(() => {
      updateSaveButtonState();
    }, remaining);
  }
}

/**
 * Check if row fields match saved entry
 */
export function checkRowFieldsMatch(
  currentRow: TimesheetRow,
  savedEntry: TimesheetRow
): boolean {
  return (
    currentRow.date === savedEntry.date &&
    currentRow.hours === savedEntry.hours &&
    currentRow.project === savedEntry.project &&
    (currentRow.tool ?? null) === (savedEntry.tool ?? null) &&
    (currentRow.chargeCode ?? null) === (savedEntry.chargeCode ?? null) &&
    currentRow.taskDescription === savedEntry.taskDescription
  );
}

/**
 * Determine if row needs update after save
 */
export function rowNeedsUpdate(
  currentRow: TimesheetRow,
  savedEntry: TimesheetRow
): boolean {
  return (
    !currentRow.id || 
    currentRow.id !== savedEntry.id ||
    currentRow.hours !== savedEntry.hours
  );
}
