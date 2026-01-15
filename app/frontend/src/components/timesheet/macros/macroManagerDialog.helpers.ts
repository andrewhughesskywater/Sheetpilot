import type { MacroRow } from "@/utils/macroStorage";
import {
  getToolsForProject,
  doesToolNeedChargeCode,
  doesProjectNeedTools,
} from "@sheetpilot/shared/business-config";

export function getToolColumnConfig(rowData: MacroRow) {
  const project = rowData.project;
  if (!project || !doesProjectNeedTools(project)) {
    return {
      className: "htDimmed htCenter",
      placeholder: project ? "N/A" : "",
      readOnly: true,
      source: [],
    };
  }
  return {
    source: [...getToolsForProject(project)],
    placeholder: "Pick a Tool",
    readOnly: false,
    className: "htCenter",
  };
}

export function getChargeCodeColumnConfig(rowData: MacroRow) {
  const tool = rowData.tool;
  if (!tool || !doesToolNeedChargeCode(tool)) {
    return {
      className: "htDimmed htCenter",
      placeholder: tool ? "N/A" : "",
      readOnly: true,
    };
  }
  return {
    placeholder: "Pick a Charge Code",
    readOnly: false,
    className: "htCenter",
  };
}

export function handleProjectChange(
  next: MacroRow[],
  rowIndex: number,
  newVal: unknown,
  oldVal: unknown
): boolean {
  const project = String(newVal ?? "");
  if (!doesProjectNeedTools(project)) {
    next[rowIndex] = {
      ...next[rowIndex],
      project,
      tool: null,
      chargeCode: null,
    };
  } else {
    // If project changed but still needs tools, keep tool if valid or reset?
    // TimesheetGrid logic resets if invalid, but let's keep it simple: reset if project changes
    if (oldVal !== newVal) {
      // Check if existing tool is valid for new project?
      // Usually better to clear to avoid invalid combinations
      next[rowIndex] = {
        ...next[rowIndex],
        project,
        tool: null,
        chargeCode: null,
      };
    } else {
      next[rowIndex] = { ...next[rowIndex], project };
    }
  }
  return true;
}

export function handleToolChange(
  next: MacroRow[],
  rowIndex: number,
  newVal: unknown
): boolean {
  const tool = String(newVal ?? "");
  if (!doesToolNeedChargeCode(tool)) {
    next[rowIndex] = { ...next[rowIndex], tool, chargeCode: null };
  } else {
    next[rowIndex] = { ...next[rowIndex], tool };
  }
  return true;
}

export function handleHoursChange(
  next: MacroRow[],
  rowIndex: number,
  newVal: unknown
): boolean {
  // Convert to number if string
  const hoursValue = typeof newVal === "number" ? newVal : Number(newVal);
  const updatedRow: MacroRow = { ...next[rowIndex] };
  if (!isNaN(hoursValue)) {
    updatedRow.hours = hoursValue;
  } else {
    // Remove hours property if invalid
    delete updatedRow.hours;
  }
  next[rowIndex] = updatedRow;
  return true;
}

export function handleStandardUpdate(
  next: MacroRow[],
  rowIndex: number,
  field: keyof MacroRow,
  newVal: unknown
): boolean {
  // Standard update
  next[rowIndex] = { ...next[rowIndex], [field]: newVal };
  return true;
}
