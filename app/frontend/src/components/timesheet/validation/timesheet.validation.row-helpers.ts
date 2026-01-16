import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import {
  isValidDate,
  isValidHours,
} from "@/components/timesheet/schema/timesheet.schema";
import {
  doesProjectNeedTools,
  doesToolNeedChargeCode,
} from "@sheetpilot/shared/business-config";

function getDateError(row: TimesheetRow, rowNum: number): string | null {
  if (!row.date) {
    return `Row ${rowNum}: Missing date`;
  }
  if (!isValidDate(row.date)) {
    return `Row ${rowNum}: Invalid date format "${row.date}"`;
  }
  return null;
}

function getHoursError(row: TimesheetRow, rowNum: number): string | null {
  if (row.hours === undefined || row.hours === null) {
    return `Row ${rowNum}: Missing hours`;
  }
  if (!isValidHours(row.hours)) {
    return `Row ${rowNum}: Invalid hours "${row.hours}" (must be between 0.25 and 24.0 in 15-minute increments)`;
  }
  return null;
}

function getProjectError(row: TimesheetRow, rowNum: number): string | null {
  if (!row.project) {
    return `Row ${rowNum}: Missing project`;
  }
  return null;
}

function getTaskDescriptionError(
  row: TimesheetRow,
  rowNum: number
): string | null {
  if (!row.taskDescription) {
    return `Row ${rowNum}: Missing task description`;
  }
  return null;
}

function getToolError(row: TimesheetRow, rowNum: number): string | null {
  if (row.project && doesProjectNeedTools(row.project) && !row.tool) {
    return `Row ${rowNum}: Project "${row.project}" requires a tool`;
  }
  return null;
}

function getChargeCodeError(row: TimesheetRow, rowNum: number): string | null {
  if (row.tool && doesToolNeedChargeCode(row.tool) && !row.chargeCode) {
    return `Row ${rowNum}: Tool "${row.tool}" requires a charge code`;
  }
  return null;
}

function validateSingleRow(
  row: TimesheetRow,
  rowNum: number,
  errorDetails: string[]
): boolean {
  const errors = [
    getDateError(row, rowNum),
    getHoursError(row, rowNum),
    getProjectError(row, rowNum),
    getTaskDescriptionError(row, rowNum),
    getToolError(row, rowNum),
    getChargeCodeError(row, rowNum),
  ].filter((error): error is string => Boolean(error));

  errorDetails.push(...errors);

  return errors.length > 0;
}

export { validateSingleRow };
