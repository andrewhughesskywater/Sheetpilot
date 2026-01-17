/**
 * @fileoverview Business Configuration - Async Database-Backed Functions
 *
 * Asynchronous functions that prefer database values over static fallback.
 * These functions use IPC to query the database and cache results for performance.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025-10-01
 */

import {
  PROJECTS_WITHOUT_TOOLS,
  TOOLS_BY_PROJECT,
} from "./business-config.static";
import {
  getAllProjects,
  getAllChargeCodes,
  getToolsForProject,
  isProjectWithoutTools,
} from "./business-config.sync";

// ============================================================================
// ASYNC FUNCTIONS (Database-backed with static fallback)
// ============================================================================

/**
 * Module-level cache for loaded configuration
 */
let cachedConfig: {
  projects?: readonly string[];
  projectsWithoutTools?: readonly string[];
  tools?: readonly string[];
  toolsWithoutChargeCodes?: readonly string[];
  chargeCodes?: readonly string[];
  toolsByProject?: Map<string, readonly string[]>;
} | null = null;

/**
 * Checks if we're in a browser environment with IPC available
 */
function isIpcAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.businessConfig !== "undefined"
  );
}

/**
 * Gets all available projects (async, database-first with static fallback)
 */
export async function getAllProjectsAsync(): Promise<readonly string[]> {
  if (cachedConfig?.projects) {
    return cachedConfig.projects;
  }

  if (isIpcAvailable() && window.businessConfig) {
    try {
      const result = await window.businessConfig.getAllProjects();
      if (result.success && result.projects) {
        if (!cachedConfig) {
          cachedConfig = {};
        }
        cachedConfig.projects = result.projects;
        return result.projects;
      }
    } catch (error) {
      // Fall through to static fallback
      console.warn(
        "Could not load projects from database, using static fallback",
        error
      );
    }
  }

  // Static fallback
  return getAllProjects();
}

/**
 * Gets projects that do not require tools (async, database-first with static fallback)
 */
export async function getProjectsWithoutToolsAsync(): Promise<
  readonly string[]
> {
  if (cachedConfig?.projectsWithoutTools) {
    return cachedConfig.projectsWithoutTools;
  }

  if (isIpcAvailable() && window.businessConfig) {
    try {
      const result = await window.businessConfig.getProjectsWithoutTools();
      if (result.success && result.projects) {
        if (!cachedConfig) {
          cachedConfig = {};
        }
        cachedConfig.projectsWithoutTools = result.projects;
        return result.projects;
      }
    } catch (error) {
      console.warn(
        "Could not load projects without tools from database, using static fallback",
        error
      );
    }
  }

  // Static fallback
  return PROJECTS_WITHOUT_TOOLS;
}

/**
 * Gets tools for a specific project (async, database-first with static fallback)
 */
export async function getToolsForProjectAsync(
  project: string
): Promise<readonly string[]> {
  if (!project) {
    return [];
  }

  // Check cache first
  if (cachedConfig?.toolsByProject?.has(project)) {
    return cachedConfig.toolsByProject.get(project)!;
  }

  // Check if project requires tools (use static check for immediate response)
  if (isProjectWithoutTools(project)) {
    return [];
  }

  if (isIpcAvailable() && window.businessConfig) {
    try {
      const result = await window.businessConfig.getToolsForProject(project);
      if (result.success && result.tools) {
        if (!cachedConfig) {
          cachedConfig = {};
        }
        if (!cachedConfig.toolsByProject) {
          cachedConfig.toolsByProject = new Map();
        }
        cachedConfig.toolsByProject.set(project, result.tools);
        return result.tools;
      }
    } catch (error) {
      console.warn(
        "Could not load tools for project from database, using static fallback",
        error
      );
    }
  }

  // Static fallback
  return getToolsForProject(project);
}

/**
 * Gets all available tools (async, database-first with static fallback)
 */
export async function getAllToolsAsync(): Promise<readonly string[]> {
  if (cachedConfig?.tools) {
    return cachedConfig.tools;
  }

  if (isIpcAvailable() && window.businessConfig) {
    try {
      const result = await window.businessConfig.getAllTools();
      if (result.success && result.tools) {
        if (!cachedConfig) {
          cachedConfig = {};
        }
        cachedConfig.tools = result.tools;
        return result.tools;
      }
    } catch (error) {
      console.warn(
        "Could not load tools from database, using static fallback",
        error
      );
    }
  }

  // Static fallback - collect all unique tools from TOOLS_BY_PROJECT
  const allToolsSet = new Set<string>();
  Object.values(TOOLS_BY_PROJECT).forEach((tools) => {
    tools.forEach((tool) => allToolsSet.add(tool));
  });
  return Array.from(allToolsSet);
}

/**
 * Gets tools that do not require charge codes (async, database-first with static fallback)
 */
export async function getToolsWithoutChargeCodesAsync(): Promise<
  readonly string[]
> {
  if (cachedConfig?.toolsWithoutChargeCodes) {
    return cachedConfig.toolsWithoutChargeCodes;
  }

  if (isIpcAvailable() && window.businessConfig) {
    try {
      const result = await window.businessConfig.getToolsWithoutChargeCodes();
      if (result.success && result.tools) {
        if (!cachedConfig) {
          cachedConfig = {};
        }
        cachedConfig.toolsWithoutChargeCodes = result.tools;
        return result.tools;
      }
    } catch (error) {
      console.warn(
        "Could not load tools without charge codes from database, using static fallback",
        error
      );
    }
  }

  // Static fallback
  return PROJECTS_WITHOUT_TOOLS;
}

/**
 * Gets all available charge codes (async, database-first with static fallback)
 */
export async function getAllChargeCodesAsync(): Promise<readonly string[]> {
  if (cachedConfig?.chargeCodes) {
    return cachedConfig.chargeCodes;
  }

  if (isIpcAvailable() && window.businessConfig) {
    try {
      const result = await window.businessConfig.getAllChargeCodes();
      if (result.success && result.chargeCodes) {
        if (!cachedConfig) {
          cachedConfig = {};
        }
        cachedConfig.chargeCodes = result.chargeCodes;
        return result.chargeCodes;
      }
    } catch (error) {
      console.warn(
        "Could not load charge codes from database, using static fallback",
        error
      );
    }
  }

  // Static fallback
  return getAllChargeCodes();
}

/**
 * Invalidates the module-level cache
 * Call this when configuration is updated
 */
export function invalidateConfigCache(): void {
  cachedConfig = null;
}
