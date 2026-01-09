import type { TimesheetRow } from '../timesheet.schema';
import { isTimeOutAfterTimeIn,isValidDate, isValidTime } from '../timesheet.schema';

export function useRowValidation() {
  function validateRequiredFields(row: TimesheetRow, rowNum: number): string[] {
    const errors: string[] = [];
    if (!row.date) errors.push(`Row ${rowNum}: Missing date`);
    else if (!isValidDate(row.date)) errors.push(`Row ${rowNum}: Invalid date format "${row.date}"`);
    if (!row.timeIn) errors.push(`Row ${rowNum}: Missing start time`);
    else if (!isValidTime(row.timeIn))
      errors.push(`Row ${rowNum}: Invalid start time "${row.timeIn}" (must be HH:MM in 15-min increments)`);
    if (!row.timeOut) errors.push(`Row ${rowNum}: Missing end time`);
    else if (!isValidTime(row.timeOut))
      errors.push(`Row ${rowNum}: Invalid end time "${row.timeOut}" (must be HH:MM in 15-min increments)`);
    if (!row.project) errors.push(`Row ${rowNum}: Missing project`);
    if (!row.taskDescription) errors.push(`Row ${rowNum}: Missing task description`);
    return errors;
  }

  function validateBusinessRules(
    row: TimesheetRow,
    rowNum: number,
    projectNeedsTools: (p?: string) => boolean,
    toolNeedsChargeCode: (t?: string) => boolean
  ): string[] {
    const errors: string[] = [];
    if (row.project && projectNeedsTools(row.project) && !row.tool) {
      errors.push(`Row ${rowNum}: Project "${row.project}" requires a tool`);
    }
    if (row.tool && toolNeedsChargeCode(row.tool) && !row.chargeCode) {
      errors.push(`Row ${rowNum}: Tool "${row.tool}" requires a charge code`);
    }
    if (row.timeIn && row.timeOut && !isTimeOutAfterTimeIn(row.timeIn, row.timeOut)) {
      errors.push(`Row ${rowNum}: End time ${row.timeOut} must be after start time ${row.timeIn}`);
    }
    return errors;
  }

  return { validateRequiredFields, validateBusinessRules };
}
