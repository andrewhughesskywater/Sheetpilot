/**
 * @fileoverview Dropdown Cascading Logic
 * 
 * Business logic for cascading dropdowns (project -> tool -> charge code).
 * Now uses shared business configuration for consistency across frontend/backend.
 * 
 * @author Andrew Hughes
 * @version 2.0.0
 * @since 2025-10-01
 */

import {
  PROJECTS_WITHOUT_TOOLS,
  TOOLS_WITHOUT_CHARGES,
  PROJECTS,
  TOOLS_BY_PROJECT,
  CHARGE_CODES,
  getToolsForProject as getToolsForProjectShared,
  doesProjectNeedTools,
  doesToolNeedChargeCode
} from '../../../shared/business-config';

/**
 * @deprecated Use PROJECTS_WITHOUT_TOOLS from business-config
 * Re-exported for backward compatibility
 */
export const projectsWithoutTools = new Set(PROJECTS_WITHOUT_TOOLS);

/**
 * @deprecated Use TOOLS_WITHOUT_CHARGES from business-config
 * Re-exported for backward compatibility
 */
export const toolsWithoutCharges = new Set(TOOLS_WITHOUT_CHARGES);

/**
 * @deprecated Use PROJECTS from business-config
 * Re-exported for backward compatibility
 */
export const projects = [...PROJECTS];

/**
 * @deprecated Use TOOLS_BY_PROJECT from business-config
 * Re-exported for backward compatibility
 */
export const toolsByProject = TOOLS_BY_PROJECT as Record<string, string[]>;

/**
 * @deprecated Use CHARGE_CODES from business-config
 * Re-exported for backward compatibility
 */
export const chargeCodes = [...CHARGE_CODES];

/**
 * Get available tools for a project
 * @deprecated Use getToolsForProject from business-config
 * Re-exported for backward compatibility
 */
export function getToolOptions(project?: string): string[] {
  if (!project) return [];
  // Handle whitespace-only strings
  if (typeof project === 'string' && project.trim() === '') return [];
  return [...getToolsForProjectShared(project)];
}

/**
 * Check if a tool needs a charge code
 * @deprecated Use doesToolNeedChargeCode from business-config
 * Re-exported for backward compatibility
 */
export function toolNeedsChargeCode(tool?: string): boolean {
  if (!tool) return false;
  // Handle whitespace-only strings
  if (typeof tool === 'string' && tool.trim() === '') return false;
  return doesToolNeedChargeCode(tool);
}

/**
 * Check if a project needs tool selection
 * @deprecated Use doesProjectNeedTools from business-config
 * Re-exported for backward compatibility
 */
export function projectNeedsTools(project?: string): boolean {
  if (!project) return false;
  // Handle whitespace-only strings
  if (typeof project === 'string' && project.trim() === '') return false;
  return doesProjectNeedTools(project);
}

