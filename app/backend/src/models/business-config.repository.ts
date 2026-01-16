/**
 * @fileoverview Business Configuration Repository
 *
 * Handles all business configuration database operations.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { dbLogger } from "@sheetpilot/shared/logger";
import { getDb } from "./connection-manager";
import type {
  Project,
  Tool,
  ChargeCode,
  ProjectUpdate,
  ToolUpdate,
  ChargeCodeUpdate,
  ProjectCreate,
  ToolCreate,
  ChargeCodeCreate,
} from "./business-config.repository.types";

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

/**
 * Updates a project
 */
export function updateProject(id: number, updates: ProjectUpdate): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.requires_tools !== undefined) {
    fields.push("requires_tools = ?");
    values.push(updates.requires_tools ? 1 : 0);
  }
  if (updates.display_order !== undefined) {
    fields.push("display_order = ?");
    values.push(updates.display_order);
  }
  if (updates.is_active !== undefined) {
    fields.push("is_active = ?");
    values.push(updates.is_active ? 1 : 0);
  }

  if (fields.length === 0) {
    dbLogger.warn("No fields to update for project", { id });
    return;
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const sql = `UPDATE business_config_projects SET ${fields.join(
    ", "
  )} WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);

  dbLogger.info("Project updated", { id, updates });
}

/**
 * Updates a tool
 */
export function updateTool(id: number, updates: ToolUpdate): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.requires_charge_code !== undefined) {
    fields.push("requires_charge_code = ?");
    values.push(updates.requires_charge_code ? 1 : 0);
  }
  if (updates.display_order !== undefined) {
    fields.push("display_order = ?");
    values.push(updates.display_order);
  }
  if (updates.is_active !== undefined) {
    fields.push("is_active = ?");
    values.push(updates.is_active ? 1 : 0);
  }

  if (fields.length === 0) {
    dbLogger.warn("No fields to update for tool", { id });
    return;
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const sql = `UPDATE business_config_tools SET ${fields.join(
    ", "
  )} WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);

  dbLogger.info("Tool updated", { id, updates });
}

/**
 * Updates a charge code
 */
export function updateChargeCode(id: number, updates: ChargeCodeUpdate): void {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.display_order !== undefined) {
    fields.push("display_order = ?");
    values.push(updates.display_order);
  }
  if (updates.is_active !== undefined) {
    fields.push("is_active = ?");
    values.push(updates.is_active ? 1 : 0);
  }

  if (fields.length === 0) {
    dbLogger.warn("No fields to update for charge code", { id });
    return;
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const sql = `UPDATE business_config_charge_codes SET ${fields.join(
    ", "
  )} WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);

  dbLogger.info("Charge code updated", { id, updates });
}

/**
 * Adds a new project
 */
export function addProject(project: ProjectCreate): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO business_config_projects (name, requires_tools, display_order, is_active)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(
    project.name,
    project.requires_tools !== undefined ? (project.requires_tools ? 1 : 0) : 1,
    project.display_order ?? 0,
    project.is_active !== undefined ? (project.is_active ? 1 : 0) : 1
  );
  dbLogger.info("Project added", {
    id: Number(result.lastInsertRowid),
    name: project.name,
  });
  return Number(result.lastInsertRowid);
}

/**
 * Adds a new tool
 */
export function addTool(tool: ToolCreate): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO business_config_tools (name, requires_charge_code, display_order, is_active)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(
    tool.name,
    tool.requires_charge_code !== undefined
      ? tool.requires_charge_code
        ? 1
        : 0
      : 1,
    tool.display_order ?? 0,
    tool.is_active !== undefined ? (tool.is_active ? 1 : 0) : 1
  );
  dbLogger.info("Tool added", {
    id: Number(result.lastInsertRowid),
    name: tool.name,
  });
  return Number(result.lastInsertRowid);
}

/**
 * Adds a new charge code
 */
export function addChargeCode(chargeCode: ChargeCodeCreate): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO business_config_charge_codes (name, display_order, is_active)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(
    chargeCode.name,
    chargeCode.display_order ?? 0,
    chargeCode.is_active !== undefined ? (chargeCode.is_active ? 1 : 0) : 1
  );
  dbLogger.info("Charge code added", {
    id: Number(result.lastInsertRowid),
    name: chargeCode.name,
  });
  return Number(result.lastInsertRowid);
}

/**
 * Links a tool to a project
 */
export function linkToolToProject(
  projectId: number,
  toolId: number,
  displayOrder?: number
): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO business_config_tools_by_project (project_id, tool_id, display_order)
    VALUES (?, ?, ?)
    ON CONFLICT(project_id, tool_id) DO UPDATE SET display_order = excluded.display_order
  `);
  stmt.run(projectId, toolId, displayOrder ?? 0);
  dbLogger.info("Tool linked to project", { projectId, toolId, displayOrder });
}

/**
 * Unlinks a tool from a project
 */
export function unlinkToolFromProject(projectId: number, toolId: number): void {
  const db = getDb();
  const stmt = db.prepare(`
    DELETE FROM business_config_tools_by_project
    WHERE project_id = ? AND tool_id = ?
  `);
  stmt.run(projectId, toolId);
  dbLogger.info("Tool unlinked from project", { projectId, toolId });
}
