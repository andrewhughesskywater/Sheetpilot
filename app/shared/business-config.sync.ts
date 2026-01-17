/**
 * @fileoverview Business Configuration - Synchronous Business Logic
 *
 * Synchronous validation and business rule functions that work with static data.
 * These are used for immediate UI validation and simple checks without database queries.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025-10-01
 */

import {
  PROJECTS_WITHOUT_TOOLS_SET,
  TOOLS_WITHOUT_CHARGES_SET,
  PROJECTS_SET,
  CHARGE_CODES_SET,
  TOOLS_BY_PROJECT,
  PROJECTS,
  CHARGE_CODES,
  PROJECTS_WITHOUT_TOOLS,
  type ProjectWithoutTools,
  type ToolWithoutCharges,
  type Project,
  type ChargeCode,
} from "./business-config.static";

// ============================================================================
// BUSINESS LOGIC FUNCTIONS
// ============================================================================

/**
 * Gets the list of tools available for a given project
 * @param project - The project name
 * @returns Readonly array of tool names, or empty array if project doesn't require tools
 */
export function getToolsForProject(project: string): readonly string[] {
  if (!project || isProjectWithoutTools(project)) {
    return [];
  }
  return TOOLS_BY_PROJECT[project] || [];
}

/**
 * Checks if a project requires tools
 * @param project - The project name
 * @returns True if the project requires tools
 */
export function doesProjectNeedTools(project: string): boolean {
  return !!project && !isProjectWithoutTools(project);
}

/**
 * Checks if a project does NOT require tools
 * @param project - The project name
 * @returns True if the project does not require tools
 */
export function isProjectWithoutTools(
  project: string
): project is ProjectWithoutTools {
  return typeof project === "string" && PROJECTS_WITHOUT_TOOLS_SET.has(project);
}

/**
 * Checks if a tool requires charge codes
 * @param tool - The tool name
 * @returns True if the tool requires charge codes
 */
export function doesToolNeedChargeCode(tool: string): boolean {
  return !!tool && !isToolWithoutChargeCode(tool);
}

/**
 * Checks if a tool does NOT require charge codes
 * @param tool - The tool name
 * @returns True if the tool does not require charge codes
 */
export function isToolWithoutChargeCode(
  tool: string
): tool is ToolWithoutCharges {
  return typeof tool === "string" && TOOLS_WITHOUT_CHARGES_SET.has(tool);
}

/**
 * Gets all available projects
 * @returns Array of project names
 */
export function getAllProjects(): readonly string[] {
  return PROJECTS;
}

/**
 * Gets all available charge codes
 * @returns Array of charge code names
 */
export function getAllChargeCodes(): readonly string[] {
  return CHARGE_CODES;
}

/**
 * Validates if a project is valid
 * @param project - The project name to validate
 * @returns True if the project is valid
 */
export function isValidProject(project: string): project is Project {
  return typeof project === "string" && PROJECTS_SET.has(project);
}

/**
 * Validates if a tool is valid for a given project
 * @param tool - The tool name to validate
 * @param project - The project name
 * @returns True if the tool is valid for the project
 */
export function isValidToolForProject(tool: string, project: string): boolean {
  if (!project || isProjectWithoutTools(project)) {
    return false; // No tools allowed for this project
  }
  const validTools = getToolsForProject(project);
  return validTools.includes(tool);
}

/**
 * Validates if a charge code is valid
 * @param chargeCode - The charge code to validate
 * @returns True if the charge code is valid
 */
export function isValidChargeCode(
  chargeCode: string
): chargeCode is ChargeCode {
  return typeof chargeCode === "string" && CHARGE_CODES_SET.has(chargeCode);
}

/**
 * Normalizes a timesheet row based on business rules
 * Clears invalid dependent fields when parent selections change
 * @param row - The timesheet row to normalize
 * @returns Normalized timesheet row
 */
export interface TimesheetRow {
  date?: string;
  timeIn?: string;
  timeOut?: string;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
}

export function normalizeTimesheetRow(row: TimesheetRow): TimesheetRow {
  const normalized = { ...row };

  // If project doesn't need tools, clear tool and charge code
  if (normalized.project && !doesProjectNeedTools(normalized.project)) {
    normalized.tool = null;
    normalized.chargeCode = null;
  }

  // If tool doesn't need charge code, clear charge code
  if (normalized.tool && !doesToolNeedChargeCode(normalized.tool)) {
    normalized.chargeCode = null;
  }

  return normalized;
}

// Re-export PROJECTS_WITHOUT_TOOLS for convenience
export { PROJECTS_WITHOUT_TOOLS };
