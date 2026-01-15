/**
 * @fileoverview Business Configuration IPC Service
 *
 * Wrapper functions for business configuration IPC calls.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

/**
 * Gets all available projects
 */
export async function getAllProjects(): Promise<{
  success: boolean;
  projects?: readonly string[];
  error?: string;
}> {
  if (!window.businessConfig?.getAllProjects) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.getAllProjects();
}

/**
 * Gets projects that do not require tools
 */
export async function getProjectsWithoutTools(): Promise<{
  success: boolean;
  projects?: readonly string[];
  error?: string;
}> {
  if (!window.businessConfig?.getProjectsWithoutTools) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.getProjectsWithoutTools();
}

/**
 * Gets tools for a specific project
 */
export async function getToolsForProject(project: string): Promise<{
  success: boolean;
  tools?: readonly string[];
  error?: string;
}> {
  if (!window.businessConfig?.getToolsForProject) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.getToolsForProject(project);
}

/**
 * Gets all available tools
 */
export async function getAllTools(): Promise<{
  success: boolean;
  tools?: readonly string[];
  error?: string;
}> {
  if (!window.businessConfig?.getAllTools) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.getAllTools();
}

/**
 * Gets tools that do not require charge codes
 */
export async function getToolsWithoutChargeCodes(): Promise<{
  success: boolean;
  tools?: readonly string[];
  error?: string;
}> {
  if (!window.businessConfig?.getToolsWithoutChargeCodes) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.getToolsWithoutChargeCodes();
}

/**
 * Gets all available charge codes
 */
export async function getAllChargeCodes(): Promise<{
  success: boolean;
  chargeCodes?: readonly string[];
  error?: string;
}> {
  if (!window.businessConfig?.getAllChargeCodes) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.getAllChargeCodes();
}

/**
 * Validates if a project is valid
 */
export async function validateProject(project: string): Promise<{
  success: boolean;
  isValid?: boolean;
  error?: string;
}> {
  if (!window.businessConfig?.validateProject) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.validateProject(project);
}

/**
 * Validates if a tool is valid for a given project
 */
export async function validateToolForProject(
  tool: string,
  project: string
): Promise<{
  success: boolean;
  isValid?: boolean;
  error?: string;
}> {
  if (!window.businessConfig?.validateToolForProject) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.validateToolForProject(tool, project);
}

/**
 * Validates if a charge code is valid
 */
export async function validateChargeCode(chargeCode: string): Promise<{
  success: boolean;
  isValid?: boolean;
  error?: string;
}> {
  if (!window.businessConfig?.validateChargeCode) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.validateChargeCode(chargeCode);
}

/**
 * Updates a project (admin only)
 */
export async function updateProject(
  token: string,
  id: number,
  updates: {
    name?: string;
    requires_tools?: boolean;
    display_order?: number;
    is_active?: boolean;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!window.businessConfig?.updateProject) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.updateProject(token, id, updates);
}

/**
 * Updates a tool (admin only)
 */
export async function updateTool(
  token: string,
  id: number,
  updates: {
    name?: string;
    requires_charge_code?: boolean;
    display_order?: number;
    is_active?: boolean;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!window.businessConfig?.updateTool) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.updateTool(token, id, updates);
}

/**
 * Updates a charge code (admin only)
 */
export async function updateChargeCode(
  token: string,
  id: number,
  updates: {
    name?: string;
    display_order?: number;
    is_active?: boolean;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!window.businessConfig?.updateChargeCode) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.updateChargeCode(token, id, updates);
}

/**
 * Adds a new project (admin only)
 */
export async function addProject(
  token: string,
  project: {
    name: string;
    requires_tools?: boolean;
    display_order?: number;
    is_active?: boolean;
  }
): Promise<{
  success: boolean;
  id?: number;
  error?: string;
}> {
  if (!window.businessConfig?.addProject) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.addProject(token, project);
}

/**
 * Adds a new tool (admin only)
 */
export async function addTool(
  token: string,
  tool: {
    name: string;
    requires_charge_code?: boolean;
    display_order?: number;
    is_active?: boolean;
  }
): Promise<{
  success: boolean;
  id?: number;
  error?: string;
}> {
  if (!window.businessConfig?.addTool) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.addTool(token, tool);
}

/**
 * Adds a new charge code (admin only)
 */
export async function addChargeCode(
  token: string,
  chargeCode: {
    name: string;
    display_order?: number;
    is_active?: boolean;
  }
): Promise<{
  success: boolean;
  id?: number;
  error?: string;
}> {
  if (!window.businessConfig?.addChargeCode) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.addChargeCode(token, chargeCode);
}

/**
 * Links a tool to a project (admin only)
 */
export async function linkToolToProject(
  token: string,
  projectId: number,
  toolId: number,
  displayOrder?: number
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!window.businessConfig?.linkToolToProject) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.linkToolToProject(token, projectId, toolId, displayOrder);
}

/**
 * Unlinks a tool from a project (admin only)
 */
export async function unlinkToolFromProject(
  token: string,
  projectId: number,
  toolId: number
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!window.businessConfig?.unlinkToolFromProject) {
    return { success: false, error: "Business config API not available" };
  }
  return window.businessConfig.unlinkToolFromProject(token, projectId, toolId);
}
