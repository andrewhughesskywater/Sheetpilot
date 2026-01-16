import { getDb } from "./connection-manager";
import type { Project, Tool, ChargeCode } from "./business-config.repository.types";

/**
 * Gets all active projects
 */
export function getAllProjects(): Project[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM business_config_projects
    WHERE is_active = 1
    ORDER BY display_order, name
  `);
  return stmt.all() as Project[];
}

/**
 * Gets projects that do not require tools
 */
export function getProjectsWithoutTools(): string[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT name FROM business_config_projects
    WHERE is_active = 1 AND requires_tools = 0
    ORDER BY display_order, name
  `);
  const rows = stmt.all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

/**
 * Gets all active tools
 */
export function getAllTools(): Tool[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM business_config_tools
    WHERE is_active = 1
    ORDER BY display_order, name
  `);
  return stmt.all() as Tool[];
}

/**
 * Gets tools that do not require charge codes
 */
export function getToolsWithoutChargeCodes(): string[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT name FROM business_config_tools
    WHERE is_active = 1 AND requires_charge_code = 0
    ORDER BY display_order, name
  `);
  const rows = stmt.all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

/**
 * Gets tools for a specific project
 */
export function getToolsByProject(projectName: string): string[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT t.name
    FROM business_config_tools t
    INNER JOIN business_config_tools_by_project tbp ON t.id = tbp.tool_id
    INNER JOIN business_config_projects p ON tbp.project_id = p.id
    WHERE p.name = ? AND p.is_active = 1 AND t.is_active = 1
    ORDER BY tbp.display_order, t.name
  `);
  const rows = stmt.all(projectName) as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

/**
 * Gets all active charge codes
 */
export function getAllChargeCodes(): string[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT name FROM business_config_charge_codes
    WHERE is_active = 1
    ORDER BY display_order, name
  `);
  const rows = stmt.all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

/**
 * Gets a project by ID
 */
export function getProjectById(id: number): Project | undefined {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM business_config_projects WHERE id = ?
  `);
  return stmt.get(id) as Project | undefined;
}

/**
 * Gets a project by name
 */
export function getProjectByName(name: string): Project | undefined {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM business_config_projects WHERE name = ?
  `);
  return stmt.get(name) as Project | undefined;
}

/**
 * Gets a tool by ID
 */
export function getToolById(id: number): Tool | undefined {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM business_config_tools WHERE id = ?
  `);
  return stmt.get(id) as Tool | undefined;
}

/**
 * Gets a tool by name
 */
export function getToolByName(name: string): Tool | undefined {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM business_config_tools WHERE name = ?
  `);
  return stmt.get(name) as Tool | undefined;
}

/**
 * Gets a charge code by ID
 */
export function getChargeCodeById(id: number): ChargeCode | undefined {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM business_config_charge_codes WHERE id = ?
  `);
  return stmt.get(id) as ChargeCode | undefined;
}

/**
 * Gets a charge code by name
 */
export function getChargeCodeByName(name: string): ChargeCode | undefined {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM business_config_charge_codes WHERE name = ?
  `);
  return stmt.get(name) as ChargeCode | undefined;
}
