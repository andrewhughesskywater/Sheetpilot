/**
 * Helper functions for updating TimesheetGrid column sources
 */

import type { HotTableRef } from "@handsontable/react-wrapper";
import { logError, logVerbose } from "@/services/ipc/logger";

// Column definition type compatible with Handsontable's ColumnSettings
// This is a subset that we work with for column updates
type ColumnDefinition = {
  data?: string | number;
  source?: string[];
  [key: string]: unknown;
};

/**
 * Find charge code and project columns
 */
function findColumns(columns: ColumnDefinition[]): {
  chargeCodeCol: ColumnDefinition | undefined;
  projectCol: ColumnDefinition | undefined;
} {
  const chargeCodeCol = columns.find(col => col.data === "chargeCode");
  const projectCol = columns.find(col => col.data === "project");
  return { chargeCodeCol, projectCol };
}

/**
 * Update columns with new sources for charge code and project
 */
function updateColumnSources(
  columns: ColumnDefinition[],
  projectsResult: readonly string[],
  chargeCodesResult: readonly string[]
): ColumnDefinition[] {
  return columns.map((col) => {
    if (col.data === "chargeCode") {
      return { ...col, source: [...chargeCodesResult] };
    }
    if (col.data === "project") {
      return { ...col, source: [...projectsResult] };
    }
    return col;
  });
}

/**
 * Check if charge code column needs update
 */
function chargeCodeNeedsUpdate(
  chargeCodeCol: ColumnDefinition | undefined,
  chargeCodes: readonly string[]
): boolean {
  if (!chargeCodeCol) {
    return false;
  }
  return (
    !chargeCodeCol.source ||
    !Array.isArray(chargeCodeCol.source) ||
    chargeCodeCol.source.length !== chargeCodes.length ||
    !chargeCodes.every((val, i) => chargeCodeCol.source && Array.isArray(chargeCodeCol.source) && chargeCodeCol.source[i] === val)
  );
}

/**
 * Check if project column needs update
 */
function projectNeedsUpdate(
  projectCol: ColumnDefinition | undefined,
  projects: readonly string[]
): boolean {
  if (!projectCol) {
    return false;
  }
  return (
    !projectCol.source ||
    !Array.isArray(projectCol.source) ||
    projectCol.source.length !== projects.length ||
    !projects.every((val, i) => projectCol.source && Array.isArray(projectCol.source) && projectCol.source[i] === val)
  );
}

/**
 * Update columns with new sources when data available
 */
function updateColumnSourcesWithDataCheck(
  columns: ColumnDefinition[],
  projects: readonly string[],
  chargeCodes: readonly string[]
): ColumnDefinition[] {
  return columns.map((col) => {
    if (col.data === "chargeCode" && chargeCodes.length > 0) {
      return { ...col, source: [...chargeCodes] };
    }
    if (col.data === "project" && projects.length > 0) {
      return { ...col, source: [...projects] };
    }
    return col;
  });
}

/**
 * Log column source update information before update
 */
function logColumnSourceUpdateBefore(
  chargeCodeCol: ColumnDefinition | undefined,
  projectCol: ColumnDefinition | undefined
): void {
  logVerbose("[TimesheetGrid] Updating column sources", {
    foundChargeCodeCol: !!chargeCodeCol,
    foundProjectCol: !!projectCol,
    currentChargeCodeSourceLength: chargeCodeCol?.source?.length || 0,
    currentProjectSourceLength: projectCol?.source?.length || 0,
  });
}

/**
 * Verify and log column source update after update
 */
function verifyAndLogColumnSourceUpdate(
  hot: NonNullable<HotTableRef["hotInstance"]>,
  projectsResult: readonly string[],
  chargeCodesResult: readonly string[]
): void {
  const verifyColumns = hot.getSettings().columns;
  const verifyChargeCodeCol = Array.isArray(verifyColumns) ? verifyColumns.find(col => col.data === "chargeCode") : null;
  logVerbose(
    "[TimesheetGrid] Updated column sources from database",
    {
      projectsCount: projectsResult.length,
      chargeCodesCount: chargeCodesResult.length,
      chargeCodeSourceAfterUpdate: verifyChargeCodeCol?.source?.length || 0,
    }
  );
}

/**
 * Update column sources after business config loads from database
 */
export function updateColumnSourcesAfterLoad(
  hot: NonNullable<HotTableRef["hotInstance"]>,
  projectsResult: readonly string[],
  chargeCodesResult: readonly string[]
): void {
  const currentColumns = hot.getSettings().columns;
  if (!Array.isArray(currentColumns)) {
    return;
  }
  
  // Type assertion: Handsontable columns are compatible with our ColumnDefinition
  const columns = currentColumns as ColumnDefinition[];
  const { chargeCodeCol, projectCol } = findColumns(columns);
  
  logColumnSourceUpdateBefore(chargeCodeCol, projectCol);
  
  const updatedColumns = updateColumnSources(columns, projectsResult, chargeCodesResult);
  
  // Type assertion: updated columns are compatible with Handsontable's ColumnSettings
  hot.updateSettings({ columns: updatedColumns as unknown as typeof currentColumns });
  
  verifyAndLogColumnSourceUpdate(hot, projectsResult, chargeCodesResult);
}

/**
 * Update column sources when projects or chargeCodes state changes
 */
export function updateColumnSourcesFromState(
  hot: NonNullable<HotTableRef["hotInstance"]>,
  projects: readonly string[],
  chargeCodes: readonly string[]
): void {
  const currentColumns = hot.getSettings().columns;
  if (!Array.isArray(currentColumns)) {
    return;
  }

  // Type assertion: Handsontable columns are compatible with our ColumnDefinition
  const columns = currentColumns as ColumnDefinition[];
  const { chargeCodeCol, projectCol } = findColumns(columns);
  
  // Check if update is needed
  const needsChargeCodeUpdate = chargeCodeNeedsUpdate(chargeCodeCol, chargeCodes);
  const needsProjectUpdate = projectNeedsUpdate(projectCol, projects);

  if (!needsChargeCodeUpdate && !needsProjectUpdate) {
    logVerbose("[TimesheetGrid] Column sources already up to date");
    return;
  }

  const updatedColumns = updateColumnSourcesWithDataCheck(columns, projects, chargeCodes);

  try {
    // Type assertion: updated columns are compatible with Handsontable's ColumnSettings
    hot.updateSettings({ columns: updatedColumns as unknown as typeof currentColumns });
    // Force a render to ensure dropdown editors are refreshed
    hot.render();
    
    logVerbose("[TimesheetGrid] Updated column sources from state change", {
      projectsCount: projects.length,
      chargeCodesCount: chargeCodes.length,
      chargeCodeNeedsUpdate: needsChargeCodeUpdate,
      projectNeedsUpdate: needsProjectUpdate,
    });
  } catch (error) {
    logError("[TimesheetGrid] Error updating column sources", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
