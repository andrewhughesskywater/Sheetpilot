import { dbLogger } from "@sheetpilot/shared/logger";
import { getDb } from "./connection-manager";
import type {
  ProjectUpdate,
  ToolUpdate,
  ChargeCodeUpdate,
  ProjectCreate,
  ToolCreate,
  ChargeCodeCreate,
} from "./business-config.repository.types";

type UpdateCandidate = {
  clause: string;
  value: unknown;
  include: boolean;
};

const buildUpdateData = (candidates: UpdateCandidate[]) => {
  const filtered = candidates.filter((candidate) => candidate.include);
  return {
    fields: filtered.map((candidate) => candidate.clause),
    values: filtered.map((candidate) => candidate.value),
  };
};

/**
 * Updates a project
 */
export function updateProject(id: number, updates: ProjectUpdate): void {
  const db = getDb();
  const { fields, values } = buildUpdateData([
    { clause: "name = ?", value: updates.name, include: updates.name !== undefined },
    {
      clause: "requires_tools = ?",
      value: updates.requires_tools ? 1 : 0,
      include: updates.requires_tools !== undefined,
    },
    {
      clause: "display_order = ?",
      value: updates.display_order,
      include: updates.display_order !== undefined,
    },
    {
      clause: "is_active = ?",
      value: updates.is_active ? 1 : 0,
      include: updates.is_active !== undefined,
    },
  ]);

  if (fields.length === 0) {
    dbLogger.warn("No fields to update for project", { id });
    return;
  }

  const sql = `UPDATE business_config_projects SET ${[...fields, "updated_at = datetime('now')"].join(
    ", "
  )} WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values, id);

  dbLogger.info("Project updated", { id, updates });
}

/**
 * Updates a tool
 */
export function updateTool(id: number, updates: ToolUpdate): void {
  const db = getDb();
  const { fields, values } = buildUpdateData([
    { clause: "name = ?", value: updates.name, include: updates.name !== undefined },
    {
      clause: "requires_charge_code = ?",
      value: updates.requires_charge_code ? 1 : 0,
      include: updates.requires_charge_code !== undefined,
    },
    {
      clause: "display_order = ?",
      value: updates.display_order,
      include: updates.display_order !== undefined,
    },
    {
      clause: "is_active = ?",
      value: updates.is_active ? 1 : 0,
      include: updates.is_active !== undefined,
    },
  ]);

  if (fields.length === 0) {
    dbLogger.warn("No fields to update for tool", { id });
    return;
  }

  const sql = `UPDATE business_config_tools SET ${[...fields, "updated_at = datetime('now')"].join(
    ", "
  )} WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values, id);

  dbLogger.info("Tool updated", { id, updates });
}

/**
 * Updates a charge code
 */
export function updateChargeCode(id: number, updates: ChargeCodeUpdate): void {
  const db = getDb();
  const { fields, values } = buildUpdateData([
    { clause: "name = ?", value: updates.name, include: updates.name !== undefined },
    {
      clause: "display_order = ?",
      value: updates.display_order,
      include: updates.display_order !== undefined,
    },
    {
      clause: "is_active = ?",
      value: updates.is_active ? 1 : 0,
      include: updates.is_active !== undefined,
    },
  ]);

  if (fields.length === 0) {
    dbLogger.warn("No fields to update for charge code", { id });
    return;
  }

  const sql = `UPDATE business_config_charge_codes SET ${[...fields, "updated_at = datetime('now')"].join(
    ", "
  )} WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values, id);

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
