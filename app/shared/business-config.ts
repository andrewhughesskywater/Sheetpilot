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

/**
 * Projects that do not require tools
 * When these projects are selected, tool and charge code fields are cleared and disabled
 */
export const PROJECTS_WITHOUT_TOOLS = [
  "ERT",
  "PTO/RTO",
  "SWFL-CHEM/GAS",
  "Training"
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
  "N/A"
] as const;

/**
 * All available projects in the system
 */
export const PROJECTS = [
  "FL-Carver Techs",
  "FL-Carver Tools",
  "OSC-BBB",
  "PTO/RTO",
  "SWFL-CHEM/GAS",
  "SWFL-EQUIP",
  "Training"
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
  "Upgrade"
] as const;

/**
 * Tools available per project
 * Defines the cascading dropdown relationship: Project → Tools
 */
export const TOOLS_BY_PROJECT: Record<string, readonly string[]> = {
  "FL-Carver Techs": [
    "Internal Meeting", "DECA Meeting", "Logistics", "Peripherals", 
    "#1 Rinse and 2D marker", "#2 Sputter",
    "#3 Laminator 300mm", "#4 Laminator 200mm", "#5 LDI", "#5B LDI", "#6 Decover",
    "#7 Develop", "#8 Optical Metrology", "#9 Scope", "#10 Plate", "#11 Strip for dry film",
    "#12 Solvent strip RDL resist, Cu/Ti Etch", "#13 Automated Inspection", "#14 Probe",
    "#15 Shear", "#16 Laminator", "#17 Backgrind/Mount/Detape", "#18 Laser groove",
    "#19 Saw", "#20 UV treatment", "#21 Carrier Laminator", "#22 Die Attach",
    "#23 Die Position Metrology", "#24 Pre Bake Oven #1", "#25 Compression Mold",
    "#26 Integrated Bond/Debond", "#27 Post Mold Cure Oven #2", "#28 CSAM102",
    "#29 Top Grind", "#30 Panelization Metrology", "#31 O2 Plasma Clean",
    "#32 VIAX Spin Coater", "#33 VIAX Developer", "#34 VIAX Cure Oven #3",
    "#35 Ball Attach", "#36 Reflow", "#37 Flux Rinse", "#38 Laser Marker",
    "#39 Tape and Reel", "#40 FOUP Cleaner", "#41 Wafer Transfer System",
    "#42 Lead Reflow", "#43 Cure Oven Loader", "#44 Conveyor Indexers",
    "#45 Manual Bonder", "#46 Manual Debonder", "#47 SEM w/EDX", "#48 Surface Profiler",
    "#49 FTIR Spectrometer", "#52 High Power Microscope", "#56 Filmetrics",
    "#59 Auto Titrator", "#60 Cyclic Voltametry", "#62 XRF", "Backgrind Abatement",
    "PLATE101 3rd HSP Chamber", "eFocus Rapid Cure", "PGV Load Cart / FOUP racks"
  ],
  "FL-Carver Tools": [
    "Internal Meeting", "DECA Meeting", "Logistics", "Peripherals", "#1 Rinse and 2D marker", "#2 Sputter",
    "#3 Laminator 300mm", "#4 Laminator 200mm", "#5 LDI", "#5B LDI", "#6 Decover",
    "#7 Develop", "#8 Optical Metrology", "#9 Scope", "#10 Plate", "#11 Strip for dry film",
    "#12 Solvent strip RDL resist, Cu/Ti Etch", "#13 Automated Inspection", "#14 Probe",
    "#15 Shear", "#16 Laminator", "#17 Backgrind/Mount/Detape", "#18 Laser groove",
    "#19 Saw", "#20 UV treatment", "#21 Carrier Laminator", "#22 Die Attach",
    "#23 Die Position Metrology", "#24 Pre Bake Oven #1", "#25 Compression Mold",
    "#26 Integrated Bond/Debond", "#27 Post Mold Cure Oven #2", "#28 CSAM102",
    "#29 Top Grind", "#30 Panelization Metrology", "#31 O2 Plasma Clean",
    "#32 VIAX Spin Coater", "#33 VIAX Developer", "#34 VIAX Cure Oven #3",
    "#35 Ball Attach", "#36 Reflow", "#37 Flux Rinse", "#38 Laser Marker",
    "#39 Tape and Reel", "#40 FOUP Cleaner", "#41 Wafer Transfer System",
    "#42 Lead Reflow", "#43 Cure Oven Loader", "#44 Conveyor Indexers",
    "#45 Manual Bonder", "#46 Manual Debonder", "#47 SEM w/EDX", "#48 Surface Profiler",
    "#49 FTIR Spectrometer", "#52 High Power Microscope", "#56 Filmetrics",
    "#59 Auto Titrator", "#60 Cyclic Voltametry", "#62 XRF", "Backgrind Abatement",
    "PLATE101 3rd HSP Chamber", "eFocus Rapid Cure", "PGV Load Cart / FOUP racks"
  ],
  "OSC-BBB": [
    "Meeting", "Non Tool Related", "#1 CSAM101", "#2 BOND Pull Tester", "#3 Defect Measurement",
    "#4 AMICRA101", "#5 POLYCURE101", "#6 SAW101", "#7 BOND103", "#8 PLASMA101",
    "#9 Wafer or Die Ball Attach", "#10 Reflow Oven", "#11 Leak Detector", "#12 Lid Attach",
    "#13 Environmental Chamber", "#14 FEMTO101", "#15 Compression Mold Tool", "#16 LMARK101", "#17 Wire Bonder"
  ],
  "SWFL-EQUIP": [
    "Meeting", "Non Tool Related", "Training", "AFM101", "ALD101", "ALIGN101", "ANL101",
    "ASET101", "ASH101", "BLUEM101", "BOLD101", "BOND101", "BOND102", "CLN101",
    "COAT101", "COAT102", "DEBOND101", "DEBOND102", "DPS101", "DPS102", "DSM8101",
    "DSS101", "ECI101", "ENDURA101", "ENDURA102", "ETEST101", "EVAP101", "FIB101",
    "GAS101", "GONI101", "JST101", "JST102", "KLA101", "KLA102", "MIRRA102",
    "MIRRAC101", "NADA101", "NADA102", "NIKON101", "NOV101", "OVLY101", "OXID101",
    "PLATE101", "PROBE101", "PROBE102", "PROFIL101", "SCOPE101", "SCOPE102",
    "SCOPE103", "SCOPE113", "SCOPE114", "SCRIB101", "SEM101", "SRD102", "SRD103",
    "STORM101", "TAPE101", "TRAK101", "TRAK102", "TRENCH101"
  ]
} as const;

// ============================================================================
// BUSINESS LOGIC FUNCTIONS
// ============================================================================

/**
 * Gets the list of tools available for a given project
 * @param project - The project name
 * @returns Array of tool names, or empty array if project doesn't require tools
 */
export function getToolsForProject(project: string): string[] {
  if (!project || isProjectWithoutTools(project)) {
    return [];
  }
  return [...(TOOLS_BY_PROJECT[project] || [])];
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
export function isProjectWithoutTools(project: string): boolean {
  return PROJECTS_WITHOUT_TOOLS.includes(project as typeof PROJECTS_WITHOUT_TOOLS[number]);
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
export function isToolWithoutChargeCode(tool: string): boolean {
  return TOOLS_WITHOUT_CHARGES.includes(tool as typeof TOOLS_WITHOUT_CHARGES[number]);
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
export function isValidProject(project: string): boolean {
  return PROJECTS.includes(project as typeof PROJECTS[number]);
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
export function isValidChargeCode(chargeCode: string): boolean {
  return CHARGE_CODES.includes(chargeCode as typeof CHARGE_CODES[number]);
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

