import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import {
  isValidDate,
  isValidHours,
} from "@/components/timesheet/schema/timesheet.schema";
import {
  doesProjectNeedTools,
  doesToolNeedChargeCode,
} from "@sheetpilot/shared/business-config";
import { isDateInAllowedRange } from "@/utils/smartDate";
import {
  calculateDraftHoursForDate,
  calculateSubmittedHoursForDate,
} from "./timesheet.validation.calculation-helpers";

function validateDateField(value: unknown): string | null {
  if (!value) return "Please enter a date";
  if (!isValidDate(String(value))) return "Date must be like 01/15/2024";
  if (!isDateInAllowedRange(String(value)))
    return "Date must be within allowed quarter range";
  return null;
}

function validateHoursField(
  value: unknown,
  rowData: TimesheetRow | undefined,
  row: number,
  rows: TimesheetRow[],
  submittedEntries?: Array<{ date: string; hours: number | null }>
): string | null {
  if (value === undefined || value === null || value === "") {
    return "Hours is required - please enter hours worked";
  }

  const hoursValue = typeof value === "number" ? value : Number(value);

  if (isNaN(hoursValue)) {
    return "Hours must be a number (e.g., 1.25, 1.5, 2.0)";
  }

  if (!isValidHours(hoursValue)) {
    return "Hours must be between 0.25 and 24.0 in 15-minute increments (0.25, 0.5, 0.75, etc.)";
  }

  // Validate total hours per date (if date and submitted entries are available)
  if (rowData?.date && submittedEntries) {
    const date = rowData.date;
    const currentRowHours = hoursValue;

    // Calculate draft hours excluding the current row (it's being updated)
    const draftHoursExcludingCurrent = calculateDraftHoursForDate(
      date,
      rows,
      row
    );
    const submittedHours = calculateSubmittedHoursForDate(
      date,
      submittedEntries
    );

    // Total = draft (excluding current) + submitted + new hours for current row
    const totalHours =
      draftHoursExcludingCurrent + submittedHours + currentRowHours;

    if (totalHours > 24.0) {
      const draftTotal = draftHoursExcludingCurrent + currentRowHours;
      return `Total hours for ${date} exceeds 24 hours. Current total: ${totalHours.toFixed(2)} hours (${submittedHours.toFixed(2)} submitted + ${draftTotal.toFixed(2)} draft). Maximum allowed: 24.00 hours.`;
    }
  }

  return null;
}

function validateProjectField(value: unknown): string | null {
  if (!value) return "Please pick a project";
  return null;
}

function validateToolField(
  value: unknown,
  rowData: TimesheetRow | undefined
): string | null {
  const project = rowData?.project;
  if (!project || !doesProjectNeedTools(project)) {
    // Tool is N/A for this project, normalize to null
    return null;
  }
  if (!value) return "Please pick a tool for this project";
  return null;
}

function validateChargeCodeField(
  value: unknown,
  rowData: TimesheetRow | undefined
): string | null {
  const tool = rowData?.tool;
  if (!tool || !doesToolNeedChargeCode(tool)) {
    // Charge code is N/A for this tool, normalize to null
    return null;
  }
  if (!value) return "Please pick a charge code for this tool";
  return null;
}

function validateTaskDescriptionField(value: unknown): string | null {
  if (!value) return "Please describe what you did";
  return null;
}

export {
  validateDateField,
  validateHoursField,
  validateProjectField,
  validateToolField,
  validateChargeCodeField,
  validateTaskDescriptionField,
};
