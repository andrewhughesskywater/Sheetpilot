import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import {
  isValidDate,
  isValidHours,
} from "@/components/timesheet/schema/timesheet.schema";
import {
  doesProjectNeedTools,
  doesToolNeedChargeCode,
} from "@sheetpilot/shared/business-config";

function validateSingleRow(
  row: TimesheetRow,
  rowNum: number,
  errorDetails: string[]
): boolean {
  let hasErrors = false;

  // Check required fields
  if (!row.date) {
    errorDetails.push(`Row ${rowNum}: Missing date`);
    hasErrors = true;
  } else if (!isValidDate(row.date)) {
    errorDetails.push(`Row ${rowNum}: Invalid date format "${row.date}"`);
    hasErrors = true;
  }

  if (row.hours === undefined || row.hours === null) {
    errorDetails.push(`Row ${rowNum}: Missing hours`);
    hasErrors = true;
  } else if (!isValidHours(row.hours)) {
    errorDetails.push(
      `Row ${rowNum}: Invalid hours "${row.hours}" (must be between 0.25 and 24.0 in 15-minute increments)`
    );
    hasErrors = true;
  }

  if (!row.project) {
    errorDetails.push(`Row ${rowNum}: Missing project`);
    hasErrors = true;
  }

  if (!row.taskDescription) {
    errorDetails.push(`Row ${rowNum}: Missing task description`);
    hasErrors = true;
  }

  // Check if tool is required
  if (row.project && doesProjectNeedTools(row.project) && !row.tool) {
    errorDetails.push(
      `Row ${rowNum}: Project "${row.project}" requires a tool`
    );
    hasErrors = true;
  }

  // Check if charge code is required
  if (row.tool && doesToolNeedChargeCode(row.tool) && !row.chargeCode) {
    errorDetails.push(
      `Row ${rowNum}: Tool "${row.tool}" requires a charge code`
    );
    hasErrors = true;
  }

  return hasErrors;
}

export { validateSingleRow };
