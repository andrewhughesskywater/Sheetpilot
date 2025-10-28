/**
 * @fileoverview Business Configuration (Frontend)
 * 
 * Frontend re-export of shared business configuration.
 * This allows the frontend to use the same business logic as the backend.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025-10-01
 */

// Re-export all business configuration from shared
export {
  PROJECTS_WITHOUT_TOOLS,
  TOOLS_WITHOUT_CHARGES,
  PROJECTS,
  TOOLS_BY_PROJECT,
  CHARGE_CODES,
  getToolsForProject,
  doesProjectNeedTools,
  doesToolNeedChargeCode,
  isProjectWithoutTools,
  isToolWithoutChargeCode,
  getAllProjects,
  getAllChargeCodes,
  isValidProject,
  isValidToolForProject,
  isValidChargeCode,
  normalizeTimesheetRow,
  type TimesheetRow
} from '../../../shared/business-config';

