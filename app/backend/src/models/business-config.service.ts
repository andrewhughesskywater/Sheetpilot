/**
 * @fileoverview Business Configuration Service
 *
 * Service layer for business configuration with in-memory caching.
 * Provides business logic functions that mirror business-config.ts API.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { dbLogger } from "@sheetpilot/shared/logger";
import {
  getAllProjects as repoGetAllProjects,
  getProjectsWithoutTools as repoGetProjectsWithoutTools,
  getAllTools as repoGetAllTools,
  getToolsWithoutChargeCodes as repoGetToolsWithoutChargeCodes,
  getToolsByProject as repoGetToolsByProject,
  getAllChargeCodes as repoGetAllChargeCodes,
  getProjectByName,
  getToolByName,
} from "./business-config.repository";
import type { TimesheetRow } from "@sheetpilot/shared/business-config";

/**
 * Cache for frequently accessed data
 */
interface BusinessConfigCache {
  projects: readonly string[] | null;
  projectsWithoutTools: readonly string[] | null;
  tools: readonly string[] | null;
  toolsWithoutChargeCodes: readonly string[] | null;
  toolsByProject: Map<string, readonly string[]>;
  chargeCodes: readonly string[] | null;
  projectRequiresTools: Map<string, boolean>;
  toolRequiresChargeCode: Map<string, boolean>;
}

const cache: BusinessConfigCache = {
  projects: null,
  projectsWithoutTools: null,
  tools: null,
  toolsWithoutChargeCodes: null,
  toolsByProject: new Map(),
  chargeCodes: null,
  projectRequiresTools: new Map(),
  toolRequiresChargeCode: new Map(),
};

/**
 * Invalidates the entire cache
 */
export function invalidateCache(): void {
  cache.projects = null;
  cache.projectsWithoutTools = null;
  cache.tools = null;
  cache.toolsWithoutChargeCodes = null;
  cache.toolsByProject.clear();
  cache.chargeCodes = null;
  cache.projectRequiresTools.clear();
  cache.toolRequiresChargeCode.clear();
  dbLogger.verbose("Business config cache invalidated");
}

/**
 * Gets all available projects
 */
export async function getAllProjects(): Promise<readonly string[]> {
  if (cache.projects !== null) {
    return cache.projects;
  }

  const projects = repoGetAllProjects();
  const projectNames = projects.map((p) => p.name);
  cache.projects = projectNames;

  // Populate requires_tools cache
  projects.forEach((p) => {
    cache.projectRequiresTools.set(p.name, p.requires_tools);
  });

  return cache.projects;
}

/**
 * Gets projects that do not require tools
 */
export async function getProjectsWithoutTools(): Promise<readonly string[]> {
  if (cache.projectsWithoutTools !== null) {
    return cache.projectsWithoutTools;
  }

  const projectNames = repoGetProjectsWithoutTools();
  cache.projectsWithoutTools = projectNames;
  return cache.projectsWithoutTools;
}

/**
 * Gets tools for a specific project
 */
export async function getToolsForProject(
  project: string
): Promise<readonly string[]> {
  if (!project) {
    return [];
  }

  // Check cache first
  if (cache.toolsByProject.has(project)) {
    return cache.toolsByProject.get(project)!;
  }

  // Check if project requires tools
  const requiresTools = await doesProjectNeedTools(project);
  if (!requiresTools) {
    cache.toolsByProject.set(project, []);
    return [];
  }

  const toolNames = repoGetToolsByProject(project);
  cache.toolsByProject.set(project, toolNames);
  return toolNames;
}

/**
 * Gets all available tools
 */
export async function getAllTools(): Promise<readonly string[]> {
  if (cache.tools !== null) {
    return cache.tools;
  }

  const tools = repoGetAllTools();
  const toolNames = tools.map((t) => t.name);
  cache.tools = toolNames;

  // Populate requires_charge_code cache
  tools.forEach((t) => {
    cache.toolRequiresChargeCode.set(t.name, t.requires_charge_code);
  });

  return cache.tools;
}

/**
 * Gets tools that do not require charge codes
 */
export async function getToolsWithoutChargeCodes(): Promise<readonly string[]> {
  if (cache.toolsWithoutChargeCodes !== null) {
    return cache.toolsWithoutChargeCodes;
  }

  const toolNames = repoGetToolsWithoutChargeCodes();
  cache.toolsWithoutChargeCodes = toolNames;
  return cache.toolsWithoutChargeCodes;
}

/**
 * Gets all available charge codes
 */
export async function getAllChargeCodes(): Promise<readonly string[]> {
  if (cache.chargeCodes !== null) {
    return cache.chargeCodes;
  }

  const chargeCodeNames = repoGetAllChargeCodes();
  cache.chargeCodes = chargeCodeNames;
  return cache.chargeCodes;
}

/**
 * Checks if a project does NOT require tools
 */
export async function isProjectWithoutTools(project: string): Promise<boolean> {
  if (!project) {
    return false;
  }

  // Check cache first
  const cached = cache.projectRequiresTools.get(project);
  if (cached !== undefined) {
    return !cached;
  }

  // Load from database if not in cache
  const projectEntity = getProjectByName(project);
  if (!projectEntity) {
    return false;
  }

  const requiresTools = projectEntity.requires_tools;
  cache.projectRequiresTools.set(project, requiresTools);
  return !requiresTools;
}

/**
 * Checks if a project requires tools
 */
export async function doesProjectNeedTools(project: string): Promise<boolean> {
  if (!project) {
    return false;
  }

  // Check cache first
  const cached = cache.projectRequiresTools.get(project);
  if (cached !== undefined) {
    return cached;
  }

  // Load from database if not in cache
  const projectEntity = getProjectByName(project);
  if (!projectEntity) {
    return false;
  }

  const requiresTools = projectEntity.requires_tools;
  cache.projectRequiresTools.set(project, requiresTools);
  return requiresTools;
}

/**
 * Checks if a tool does NOT require charge codes
 */
export async function isToolWithoutChargeCode(tool: string): Promise<boolean> {
  if (!tool) {
    return false;
  }

  // Check cache first
  const cached = cache.toolRequiresChargeCode.get(tool);
  if (cached !== undefined) {
    return !cached;
  }

  // Load from database if not in cache
  const toolEntity = getToolByName(tool);
  if (!toolEntity) {
    return false;
  }

  const requiresChargeCode = toolEntity.requires_charge_code;
  cache.toolRequiresChargeCode.set(tool, requiresChargeCode);
  return !requiresChargeCode;
}

/**
 * Checks if a tool requires charge codes
 */
export async function doesToolNeedChargeCode(tool: string): Promise<boolean> {
  if (!tool) {
    return false;
  }

  // Check cache first
  const cached = cache.toolRequiresChargeCode.get(tool);
  if (cached !== undefined) {
    return cached;
  }

  // Load from database if not in cache
  const toolEntity = getToolByName(tool);
  if (!toolEntity) {
    return false;
  }

  const requiresChargeCode = toolEntity.requires_charge_code;
  cache.toolRequiresChargeCode.set(tool, requiresChargeCode);
  return requiresChargeCode;
}

/**
 * Validates if a project is valid
 */
export async function isValidProject(project: string): Promise<boolean> {
  if (!project) {
    return false;
  }

  const projects = await getAllProjects();
  return projects.includes(project);
}

/**
 * Validates if a tool is valid for a given project
 */
export async function isValidToolForProject(
  tool: string,
  project: string
): Promise<boolean> {
  if (!project || !tool) {
    return false;
  }

  // Check if project requires tools
  const requiresTools = await doesProjectNeedTools(project);
  if (!requiresTools) {
    return false; // No tools allowed for this project
  }

  const validTools = await getToolsForProject(project);
  return validTools.includes(tool);
}

/**
 * Validates if a charge code is valid
 */
export async function isValidChargeCode(chargeCode: string): Promise<boolean> {
  if (!chargeCode) {
    return false;
  }

  const chargeCodes = await getAllChargeCodes();
  return chargeCodes.includes(chargeCode);
}

/**
 * Normalizes a timesheet row based on business rules
 * Clears invalid dependent fields when parent selections change
 */
export async function normalizeTimesheetRow(
  row: TimesheetRow
): Promise<TimesheetRow> {
  const normalized = { ...row };

  // If project doesn't need tools, clear tool and charge code
  if (normalized.project) {
    const needsTools = await doesProjectNeedTools(normalized.project);
    if (!needsTools) {
      normalized.tool = null;
      normalized.chargeCode = null;
    }
  }

  // If tool doesn't need charge code, clear charge code
  if (normalized.tool) {
    const needsChargeCode = await doesToolNeedChargeCode(normalized.tool);
    if (!needsChargeCode) {
      normalized.chargeCode = null;
    }
  }

  return normalized;
}
