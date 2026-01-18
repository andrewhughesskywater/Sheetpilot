/**
 * @fileoverview Business Configuration - Async Database-Backed Functions
 *
 * Asynchronous functions that query the database. Database is the single source of truth.
 * These functions use IPC to query the database and cache results for performance.
 * If the database is unavailable, these functions will throw errors or return empty arrays.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025-10-01
 */

// ============================================================================
// ASYNC FUNCTIONS (Database-backed, no static fallback)
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
 * Gets all available projects (async, database-only)
 * @throws Error if database is unavailable or query fails
 */
export async function getAllProjectsAsync(): Promise<readonly string[]> {
  if (cachedConfig?.projects) {
    return cachedConfig.projects;
  }

  if (!isIpcAvailable() || !window.businessConfig) {
    throw new Error("Database not available: window.businessConfig is not available");
  }

  const result = await window.businessConfig.getAllProjects();
  if (!result.success || !result.projects) {
    throw new Error(
      `Could not load projects from database: ${result.error || "Unknown error"}`
    );
  }

  if (!cachedConfig) {
    cachedConfig = {};
  }
  cachedConfig.projects = result.projects;
  return result.projects;
}

/**
 * Gets projects that do not require tools (async, database-only)
 * @throws Error if database is unavailable or query fails
 */
export async function getProjectsWithoutToolsAsync(): Promise<
  readonly string[]
> {
  if (cachedConfig?.projectsWithoutTools) {
    return cachedConfig.projectsWithoutTools;
  }

  if (!isIpcAvailable() || !window.businessConfig) {
    throw new Error("Database not available: window.businessConfig is not available");
  }

  const result = await window.businessConfig.getProjectsWithoutTools();
  if (!result.success || !result.projects) {
    throw new Error(
      `Could not load projects without tools from database: ${result.error || "Unknown error"}`
    );
  }

  if (!cachedConfig) {
    cachedConfig = {};
  }
  cachedConfig.projectsWithoutTools = result.projects;
  return result.projects;
}

/**
 * Gets tools for a specific project (async, database-only)
 * @throws Error if database is unavailable or query fails
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

  if (!isIpcAvailable() || !window.businessConfig) {
    throw new Error("Database not available: window.businessConfig is not available");
  }

  const result = await window.businessConfig.getToolsForProject(project);
  if (!result.success) {
    throw new Error(
      `Could not load tools for project from database: ${result.error || "Unknown error"}`
    );
  }

  const tools = result.tools || [];
  if (!cachedConfig) {
    cachedConfig = {};
  }
  if (!cachedConfig.toolsByProject) {
    cachedConfig.toolsByProject = new Map();
  }
  cachedConfig.toolsByProject.set(project, tools);
  return tools;
}

/**
 * Gets all available tools (async, database-only)
 * @throws Error if database is unavailable or query fails
 */
export async function getAllToolsAsync(): Promise<readonly string[]> {
  if (cachedConfig?.tools) {
    return cachedConfig.tools;
  }

  if (!isIpcAvailable() || !window.businessConfig) {
    throw new Error("Database not available: window.businessConfig is not available");
  }

  const result = await window.businessConfig.getAllTools();
  if (!result.success || !result.tools) {
    throw new Error(
      `Could not load tools from database: ${result.error || "Unknown error"}`
    );
  }

  if (!cachedConfig) {
    cachedConfig = {};
  }
  cachedConfig.tools = result.tools;
  return result.tools;
}

/**
 * Gets tools that do not require charge codes (async, database-only)
 * @throws Error if database is unavailable or query fails
 */
export async function getToolsWithoutChargeCodesAsync(): Promise<
  readonly string[]
> {
  if (cachedConfig?.toolsWithoutChargeCodes) {
    return cachedConfig.toolsWithoutChargeCodes;
  }

  if (!isIpcAvailable() || !window.businessConfig) {
    throw new Error("Database not available: window.businessConfig is not available");
  }

  const result = await window.businessConfig.getToolsWithoutChargeCodes();
  if (!result.success || !result.tools) {
    throw new Error(
      `Could not load tools without charge codes from database: ${result.error || "Unknown error"}`
    );
  }

  if (!cachedConfig) {
    cachedConfig = {};
  }
  cachedConfig.toolsWithoutChargeCodes = result.tools;
  return result.tools;
}

/**
 * Gets all available charge codes (async, database-only)
 * @throws Error if database is unavailable or query fails
 */
export async function getAllChargeCodesAsync(): Promise<readonly string[]> {
  if (cachedConfig?.chargeCodes) {
    return cachedConfig.chargeCodes;
  }

  if (!isIpcAvailable() || !window.businessConfig) {
    throw new Error("Database not available: window.businessConfig is not available");
  }

  const result = await window.businessConfig.getAllChargeCodes();
  if (!result.success || !result.chargeCodes) {
    throw new Error(
      `Could not load charge codes from database: ${result.error || "Unknown error"}`
    );
  }

  if (!cachedConfig) {
    cachedConfig = {};
  }
  cachedConfig.chargeCodes = result.chargeCodes;
  return result.chargeCodes;
}

/**
 * Invalidates the module-level cache
 * Call this when configuration is updated
 */
export function invalidateConfigCache(): void {
  cachedConfig = null;
}
