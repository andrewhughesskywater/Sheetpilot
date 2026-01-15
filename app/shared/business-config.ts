/**
 * @fileoverview Business Configuration
 *
 * Centralizes business rules and configuration data used throughout the application.
 * This includes dropdown options, validation rules, and cascading logic.
 *
 * Business rules should be defined here rather than in UI components to:
 * 1. Enable code reuse across frontend/backend
 * 2. Facilitate testing of business logic
 * 3. Allow business rules to be updated independently of UI
 * 4. Support data validation in both UI and backend
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025-10-01
 */

// Type declaration for window.businessConfig (used in browser context)
// This matches the declaration in app/frontend/src/contracts/window.businessConfig.ts
declare global {
  interface Window {
    businessConfig?: {
      getAllProjects: () => Promise<{
        success: boolean;
        projects?: readonly string[];
        error?: string;
      }>;
      getProjectsWithoutTools: () => Promise<{
        success: boolean;
        projects?: readonly string[];
        error?: string;
      }>;
      getToolsForProject: (project: string) => Promise<{
        success: boolean;
        tools?: readonly string[];
        error?: string;
      }>;
      getAllTools: () => Promise<{
        success: boolean;
        tools?: readonly string[];
        error?: string;
      }>;
      getToolsWithoutChargeCodes: () => Promise<{
        success: boolean;
        tools?: readonly string[];
        error?: string;
      }>;
      getAllChargeCodes: () => Promise<{
        success: boolean;
        chargeCodes?: readonly string[];
        error?: string;
      }>;
      validateProject: (project: string) => Promise<{
        success: boolean;
        isValid?: boolean;
        error?: string;
      }>;
      validateToolForProject: (
        tool: string,
        project: string
      ) => Promise<{
        success: boolean;
        isValid?: boolean;
        error?: string;
      }>;
      validateChargeCode: (chargeCode: string) => Promise<{
        success: boolean;
        isValid?: boolean;
        error?: string;
      }>;
      updateProject: (
        token: string,
        id: number,
        updates: {
          name?: string;
          requires_tools?: boolean;
          display_order?: number;
          is_active?: boolean;
        }
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
      updateTool: (
        token: string,
        id: number,
        updates: {
          name?: string;
          requires_charge_code?: boolean;
          display_order?: number;
          is_active?: boolean;
        }
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
      updateChargeCode: (
        token: string,
        id: number,
        updates: {
          name?: string;
          display_order?: number;
          is_active?: boolean;
        }
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
      addProject: (
        token: string,
        project: {
          name: string;
          requires_tools?: boolean;
          display_order?: number;
          is_active?: boolean;
        }
      ) => Promise<{
        success: boolean;
        id?: number;
        error?: string;
      }>;
      addTool: (
        token: string,
        tool: {
          name: string;
          requires_charge_code?: boolean;
          display_order?: number;
          is_active?: boolean;
        }
      ) => Promise<{
        success: boolean;
        id?: number;
        error?: string;
      }>;
      addChargeCode: (
        token: string,
        chargeCode: {
          name: string;
          display_order?: number;
          is_active?: boolean;
        }
      ) => Promise<{
        success: boolean;
        id?: number;
        error?: string;
      }>;
      linkToolToProject: (
        token: string,
        projectId: number,
        toolId: number,
        displayOrder?: number
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
      unlinkToolFromProject: (
        token: string,
        projectId: number,
        toolId: number
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
    };
  }
}

export {};

/**
 * Projects that do not require tools
 * When these projects are selected, tool and charge code fields are cleared and disabled
 */
export const PROJECTS_WITHOUT_TOOLS = [
  "ERT",
  "PTO/RTO",
  "SWFL-CHEM/GAS",
  "Training",
] as const;

/**
 * Tools that do not require charge codes
 * When these tools are selected, charge code field is cleared and disabled
 */
export const TOOLS_WITHOUT_CHARGES = [
  "Internal Meeting",
  "DECA Meeting",
  "Logistics",
  "Meeting",
  "Non Tool Related",
  "Admin",
  "Training",
  "N/A",
  "COL 0b",
  "COL0c",
  "COL 2",
  "COL 3",
  "COL 5a",
  "COL 6",
  "COL 7",
  "COL 8a",
  "COL 8b",
  "COL 9",
  "COL 10b",
  "COL 12",
  "COL 13a",
  "COL 13c",
  "COL 14",
  "TC3Z",
  "COL 16",
  "COL 17",
  "COL 18",
] as const;

/**
 * All available projects in the system
 */
export const PROJECTS = [
  "269 Daytona : DECA",
  "FL-Carver Techs",
  "FL-Carver Tools",
  "OSC-BBB",
  "PTO/RTO",
  "SWFL-CHEM/GAS",
  "SWFL-EQUIP",
  "Training",
] as const;

/**
 * All available charge codes in the system
 */
export const CHARGE_CODES = [
  "Admin",
  "EPR1",
  "EPR2",
  "EPR3",
  "EPR4",
  "Repair",
  "Meeting",
  "Other",
  "PM",
  "Training",
  "Upgrade",
] as const;

/**
 * Type helpers for type-safe array membership checks
 */
type ProjectWithoutTools = (typeof PROJECTS_WITHOUT_TOOLS)[number];
type ToolWithoutCharges = (typeof TOOLS_WITHOUT_CHARGES)[number];
type Project = (typeof PROJECTS)[number];
type ChargeCode = (typeof CHARGE_CODES)[number];

/**
 * Create Sets for O(1) lookup performance
 */
const PROJECTS_WITHOUT_TOOLS_SET = new Set<string>(PROJECTS_WITHOUT_TOOLS);
const TOOLS_WITHOUT_CHARGES_SET = new Set<string>(TOOLS_WITHOUT_CHARGES);
const PROJECTS_SET = new Set<string>(PROJECTS);
const CHARGE_CODES_SET = new Set<string>(CHARGE_CODES);

/**
 * Tools available per project
 * Defines the cascading dropdown relationship: Project → Tools
 */
export const TOOLS_BY_PROJECT: Record<string, readonly string[]> = {
  "FL-Carver Techs": [
    "Internal Meeting",
    "DECA Meeting",
    "Logistics",
    "Peripherals",
    "#1 Rinse and 2D marker",
    "#2 Sputter",
    "#3 Laminator 300mm",
    "#4 Laminator 200mm",
    "#5 LDI",
    "#5B LDI",
    "#6 Decover",
    "#7 Develop",
    "#8 Optical Metrology",
    "#9 Scope",
    "#10 Plate",
    "#11 Strip for dry film",
    "#12 Solvent strip RDL resist, Cu/Ti Etch",
    "#13 Automated Inspection",
    "#14 Probe",
    "#15 Shear",
    "#16 Laminator",
    "#17 Backgrind/Mount/Detape",
    "#18 Laser groove",
    "#19 Saw",
    "#20 UV treatment",
    "#21 Carrier Laminator",
    "#22 Die Attach",
    "#23 Die Position Metrology",
    "#24 Pre Bake Oven #1",
    "#25 Compression Mold",
    "#26 Integrated Bond/Debond",
    "#27 Post Mold Cure Oven #2",
    "#28 CSAM102",
    "#29 Top Grind",
    "#30 Panelization Metrology",
    "#31 O2 Plasma Clean",
    "#32 VIAX Spin Coater",
    "#33 VIAX Developer",
    "#34 VIAX Cure Oven #3",
    "#35 Ball Attach",
    "#36 Reflow",
    "#37 Flux Rinse",
    "#38 Laser Marker",
    "#39 Tape and Reel",
    "#40 FOUP Cleaner",
    "#41 Wafer Transfer System",
    "#42 Lead Reflow",
    "#43 Cure Oven Loader",
    "#44 Conveyor Indexers",
    "#45 Manual Bonder",
    "#46 Manual Debonder",
    "#47 SEM w/EDX",
    "#48 Surface Profiler",
    "#49 FTIR Spectrometer",
    "#52 High Power Microscope",
    "#56 Filmetrics",
    "#59 Auto Titrator",
    "#60 Cyclic Voltametry",
    "#62 XRF",
    "Backgrind Abatement",
    "PLATE101 3rd HSP Chamber",
    "eFocus Rapid Cure",
    "PGV Load Cart / FOUP racks",
  ],
  "FL-Carver Tools": [
    "Internal Meeting",
    "DECA Meeting",
    "Logistics",
    "Peripherals",
    "#1 Rinse and 2D marker",
    "#2 Sputter",
    "#3 Laminator 300mm",
    "#4 Laminator 200mm",
    "#5 LDI",
    "#5B LDI",
    "#6 Decover",
    "#7 Develop",
    "#8 Optical Metrology",
    "#9 Scope",
    "#10 Plate",
    "#11 Strip for dry film",
    "#12 Solvent strip RDL resist, Cu/Ti Etch",
    "#13 Automated Inspection",
    "#14 Probe",
    "#15 Shear",
    "#16 Laminator",
    "#17 Backgrind/Mount/Detape",
    "#18 Laser groove",
    "#19 Saw",
    "#20 UV treatment",
    "#21 Carrier Laminator",
    "#22 Die Attach",
    "#23 Die Position Metrology",
    "#24 Pre Bake Oven #1",
    "#25 Compression Mold",
    "#26 Integrated Bond/Debond",
    "#27 Post Mold Cure Oven #2",
    "#28 CSAM102",
    "#29 Top Grind",
    "#30 Panelization Metrology",
    "#31 O2 Plasma Clean",
    "#32 VIAX Spin Coater",
    "#33 VIAX Developer",
    "#34 VIAX Cure Oven #3",
    "#35 Ball Attach",
    "#36 Reflow",
    "#37 Flux Rinse",
    "#38 Laser Marker",
    "#39 Tape and Reel",
    "#40 FOUP Cleaner",
    "#41 Wafer Transfer System",
    "#42 Lead Reflow",
    "#43 Cure Oven Loader",
    "#44 Conveyor Indexers",
    "#45 Manual Bonder",
    "#46 Manual Debonder",
    "#47 SEM w/EDX",
    "#48 Surface Profiler",
    "#49 FTIR Spectrometer",
    "#52 High Power Microscope",
    "#56 Filmetrics",
    "#59 Auto Titrator",
    "#60 Cyclic Voltametry",
    "#62 XRF",
    "Backgrind Abatement",
    "PLATE101 3rd HSP Chamber",
    "eFocus Rapid Cure",
    "PGV Load Cart / FOUP racks",
  ],
  "OSC-BBB": [
    "Meeting",
    "Non Tool Related",
    "#1 CSAM101",
    "#2 BOND Pull Tester",
    "#3 Defect Measurement",
    "#4 AMICRA101",
    "#5 POLYCURE101",
    "#6 SAW101",
    "#7 BOND103",
    "#8 PLASMA101",
    "#9 Wafer or Die Ball Attach",
    "#10 Reflow Oven",
    "#11 Leak Detector",
    "#12 Lid Attach",
    "#13 Environmental Chamber",
    "#14 FEMTO101",
    "#15 Compression Mold Tool",
    "#16 LMARK101",
    "#17 Wire Bonder",
  ],
  "SWFL-EQUIP": [
    "Admin",
    "Meeting",
    "Non Tool Related",
    "AFM101",
    "ALD101",
    "ALIGN101",
    "ANL101",
    "ASET101",
    "ASH101",
    "BLUEM101",
    "BOLD101",
    "BOND101",
    "BOND102",
    "CLN101",
    "COAT101",
    "COAT102",
    "DEBOND101",
    "DEBOND102",
    "DPS101",
    "DPS102",
    "DSM8101",
    "DSS101",
    "ECI101",
    "ENDURA101",
    "ENDURA102",
    "ETEST101",
    "EVAP101",
    "FIB101",
    "GAS101",
    "GONI101",
    "JST101",
    "JST102",
    "KLA101",
    "KLA102",
    "MIRRA102",
    "MIRRAC101",
    "NADA101",
    "NADA102",
    "NIKON101",
    "NOV101",
    "OVLY101",
    "OXID101",
    "PLATE101",
    "PROBE101",
    "PROBE102",
    "PROFIL101",
    "SCOPE101",
    "SCOPE102",
    "SCOPE103",
    "SCOPE113",
    "SCOPE114",
    "SCRIB101",
    "SEM101",
    "SRD102",
    "SRD103",
    "STORM101",
    "TAPE101",
    "TRAK101",
    "TRAK102",
    "TRENCH101",
  ],
  "269 Daytona : DECA": [
    "COL 0b",
    "COL0c",
    "COL 2",
    "COL 3",
    "COL 5a",
    "COL 6",
    "COL 7",
    "COL 8a",
    "COL 8b",
    "COL 9",
    "COL 10b",
    "COL 12",
    "COL 13a",
    "COL 13a",
    "COL 13c",
    "COL 14",
    "TC3Z",
    "COL 16",
    "COL 17",
    "COL 18",
  ],
} as const;

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
  return TOOLS_WITHOUT_CHARGES;
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
