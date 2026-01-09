import { useCallback } from 'react';

import type { HandsontableChange, TimesheetRow, ValidationError } from '../timesheet.schema';

interface ChangeProcessor {
  processChangesList: (changes: HandsontableChange[], rows: TimesheetRow[]) => Record<number, Record<string, unknown>>;
  applyOverlapValidation: (rowIdx: number, errors: ValidationError[], rows: TimesheetRow[]) => ValidationError[];
  applyTimeOutValidation: (rowIdx: number, errors: ValidationError[], rows: TimesheetRow[]) => ValidationError[];
  mergeValidationErrors: (allErrors: ValidationError[], newErrors: ValidationError[]) => ValidationError[];
}

export function useAfterChangeProcessing(): ChangeProcessor {
  const processChangesList = useCallback(
    (changes: HandsontableChange[], _rows: TimesheetRow[]): Record<number, Record<string, unknown>> => {
      const result: Record<number, Record<string, unknown>> = {};

      for (const change of changes) {
        if (!change) continue;

        const [rowIdx, prop, _oldValue, newValue] = change;
        if (rowIdx === null || rowIdx === undefined || prop === null) continue;

        if (!result[rowIdx]) {
          result[rowIdx] = {};
        }

        result[rowIdx][prop] = newValue;
      }

      return result;
    },
    []
  );

  const applyOverlapValidation = useCallback(
    (rowIdx: number, errors: ValidationError[], rows: TimesheetRow[]): ValidationError[] => {
      const row = rows[rowIdx];
      if (!row || !row.timeIn || !row.timeOut) return errors;

      const overlapWithPrevious = rows.slice(0, rowIdx).some((prevRow) => {
        if (!prevRow.date || !prevRow.timeIn || !prevRow.timeOut) return false;
        if (prevRow.date !== row.date) return false;

        const newStart = new Date(`2000-01-01T${row.timeIn}`);
        const newEnd = new Date(`2000-01-01T${row.timeOut}`);
        const prevStart = new Date(`2000-01-01T${prevRow.timeIn}`);
        const prevEnd = new Date(`2000-01-01T${prevRow.timeOut}`);

        return newStart < prevEnd && newEnd > prevStart;
      });

      if (overlapWithPrevious) {
        const existingOverlapError = errors.find((err) => err.field === 'timeIn' && err.type === 'timeOverlap');
        if (!existingOverlapError) {
          errors.push({
            rowIdx,
            field: 'timeIn',
            message: 'Time range overlaps with previous entry',
            type: 'timeOverlap',
          });
        }
      }

      return errors;
    },
    []
  );

  const applyTimeOutValidation = useCallback(
    (rowIdx: number, errors: ValidationError[], rows: TimesheetRow[]): ValidationError[] => {
      const row = rows[rowIdx];
      if (!row || !row.timeIn || !row.timeOut) return errors;

      const timeInDate = new Date(`2000-01-01T${row.timeIn}`);
      const timeOutDate = new Date(`2000-01-01T${row.timeOut}`);

      if (timeOutDate <= timeInDate) {
        const existingError = errors.find((err) => err.field === 'timeOut' && err.type === 'timeOutOrdering');
        if (!existingError) {
          errors.push({
            rowIdx,
            field: 'timeOut',
            message: 'timeOut must be after timeIn',
            type: 'timeOutOrdering',
          });
        }
      } else {
        // Remove timeOut ordering error if times are now valid
        const idx = errors.findIndex((err) => err.field === 'timeOut' && err.type === 'timeOutOrdering');
        if (idx >= 0) {
          errors.splice(idx, 1);
        }
      }

      return errors;
    },
    []
  );

  const mergeValidationErrors = useCallback(
    (allErrors: ValidationError[], newErrors: ValidationError[]): ValidationError[] => {
      const errorMap = new Map<string, ValidationError>();

      // Keep existing errors that aren't being replaced
      for (const error of allErrors) {
        const key = `${error.rowIdx}:${error.field}:${error.type}`;
        errorMap.set(key, error);
      }

      // Add or update with new errors
      for (const error of newErrors) {
        const key = `${error.rowIdx}:${error.field}:${error.type}`;
        errorMap.set(key, error);
      }

      return Array.from(errorMap.values());
    },
    []
  );

  return {
    processChangesList,
    applyOverlapValidation,
    applyTimeOutValidation,
    mergeValidationErrors,
  };
}
