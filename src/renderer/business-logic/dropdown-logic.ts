/**
 * @fileoverview Dropdown Cascading Logic
 * 
 * Business logic for cascading dropdowns (project -> tool -> charge code).
 * Extracted from TimesheetGrid component for reusability.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

/**
 * Projects that don't require tool selection
 */
export const projectsWithoutTools = new Set([
  "ERT",
  "PTO/RTO", 
  "SWFL-CHEM/GAS",
  "Training"
]);

/**
 * Tools that don't require charge code selection
 */
export const toolsWithoutCharges = new Set([
  "Internal Meeting",
  "DECA Meeting",
  "Logistics",
  "Meeting",
  "Non Tool Related",
  "Admin",
  "Training"
]);

/**
 * Available projects
 */
export const projects = [
  "FL-Carver Techs",
  "FL-Carver Tools",
  "OSC-BBB",
  "PTO/RTO",
  "SWFL-CHEM/GAS",
  "SWFL-EQUIP",
  "Training"
];

/**
 * Tools organized by project
 */
export const toolsByProject: Record<string, string[]> = {
  "FL-Carver Techs": [
    "DECA Meeting", "Logistics", "Peripherals", "#1 Rinse and 2D marker", "#2 Sputter",
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
    "DECA Meeting", "Logistics", "Peripherals", "#1 Rinse and 2D marker", "#2 Sputter",
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
};

/**
 * Available charge codes
 */
export const chargeCodes = [
  "Admin", "EPR1", "EPR2", "EPR3", "EPR4", "Repair", "Meeting", "Other", "PM", "Training", "Upgrade"
];

/**
 * Get available tools for a project
 */
export function getToolOptions(project?: string): string[] {
  if (!project || projectsWithoutTools.has(project)) return [];
  return toolsByProject[project] || [];
}

/**
 * Check if a tool needs a charge code
 */
export function toolNeedsChargeCode(tool?: string): boolean {
  return !!tool && !toolsWithoutCharges.has(tool);
}

/**
 * Check if a project needs tool selection
 */
export function projectNeedsTools(project?: string): boolean {
  return !!project && !projectsWithoutTools.has(project);
}

