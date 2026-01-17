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

export async function getProjectsWithoutTools(): Promise<readonly string[]> {
  if (cache.projectsWithoutTools !== null) {
    return cache.projectsWithoutTools;
  }

  const projectNames = repoGetProjectsWithoutTools();
  cache.projectsWithoutTools = projectNames;
  return cache.projectsWithoutTools;
}

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

export async function getToolsWithoutChargeCodes(): Promise<readonly string[]> {
  if (cache.toolsWithoutChargeCodes !== null) {
    return cache.toolsWithoutChargeCodes;
  }

  const toolNames = repoGetToolsWithoutChargeCodes();
  cache.toolsWithoutChargeCodes = toolNames;
  return cache.toolsWithoutChargeCodes;
}

export async function getAllChargeCodes(): Promise<readonly string[]> {
  if (cache.chargeCodes !== null) {
    return cache.chargeCodes;
  }

  const chargeCodeNames = repoGetAllChargeCodes();
  cache.chargeCodes = chargeCodeNames;
  return cache.chargeCodes;
}

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

export async function isValidProject(project: string): Promise<boolean> {
  if (!project) {
    return false;
  }

  const projects = await getAllProjects();
  return projects.includes(project);
}

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

export async function isValidChargeCode(chargeCode: string): Promise<boolean> {
  if (!chargeCode) {
    return false;
  }

  const chargeCodes = await getAllChargeCodes();
  return chargeCodes.includes(chargeCode);
}

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
