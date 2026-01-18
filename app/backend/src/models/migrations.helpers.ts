import type BetterSqlite3 from "better-sqlite3";
import { dbLogger } from "@sheetpilot/shared/logger";

function checkGeneratedInSql(sql: string): boolean {
  return /\bhours\b[\s\S]*?\bGENERATED\s+ALWAYS/i.test(sql);
}

function checkGeneratedByPragma(db: BetterSqlite3.Database): boolean {
  try {
    const tableInfo = db
      .prepare("PRAGMA table_info(timesheet)")
      .all() as Array<{
      name: string;
      type: string;
      generated?: number;
      hidden?: number;
    }>;
    const hoursCol = tableInfo.find((col) => col.name === "hours");
    if (hoursCol && (hoursCol.generated === 1 || hoursCol.hidden === 2)) {
      dbLogger.verbose(
        "Migration 3: Detected generated column via PRAGMA table_info"
      );
      return true;
    }
  } catch {
    // PRAGMA might not support this in older SQLite versions, ignore
    dbLogger.verbose(
      "Migration 3: Could not check PRAGMA table_info for generated columns"
    );
  }
  return false;
}

function checkGeneratedByTest(db: BetterSqlite3.Database): boolean {
  try {
    db.exec("SAVEPOINT migration_test");
    const testStmt = db.prepare(`
            INSERT INTO timesheet (date, hours, project, task_description)
            VALUES ('2000-01-01', 1.0, 'test', 'test')
        `);
    testStmt.run();
    // If we get here, hours is not generated
    db.exec("ROLLBACK TO migration_test");
    db.exec("RELEASE migration_test");
    return false;
  } catch (error) {
    // Rollback the savepoint
    try {
      db.exec("ROLLBACK TO migration_test");
      db.exec("RELEASE migration_test");
    } catch {
      // Ignore rollback errors
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (
      errorMsg.includes("generated column") ||
      errorMsg.includes("cannot INSERT into")
    ) {
      dbLogger.verbose(
        "Migration 3: Detected generated column via INSERT test",
        { error: errorMsg }
      );
      return true;
    }
    return false;
  }
}

export function isHoursColumnGenerated(
  db: BetterSqlite3.Database,
  sql: string
): boolean {
  const isGeneratedInSql = checkGeneratedInSql(sql);
  const isGeneratedByPragma = checkGeneratedByPragma(db);
  let isGeneratedByTest = false;
  if (!isGeneratedInSql && !isGeneratedByPragma) {
    isGeneratedByTest = checkGeneratedByTest(db);
  }
  return isGeneratedInSql || isGeneratedByPragma || isGeneratedByTest;
}

export function createTimesheetTableWithSchema(
  db: BetterSqlite3.Database
): void {
  db.exec(`
        CREATE TABLE timesheet_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hours REAL CHECK(hours IS NULL OR (hours >= 0.25 AND hours <= 24.0 AND (hours * 4) % 1 = 0)),
            date TEXT,
            project TEXT,
            tool TEXT,
            detail_charge_code TEXT,
            task_description TEXT,
            status TEXT DEFAULT NULL,
            submitted_at DATETIME DEFAULT NULL
        )
    `);
}

export function migrateTimesheetData(db: BetterSqlite3.Database): void {
  db.exec(`
        INSERT INTO timesheet_new 
        (id, hours, date, project, tool, detail_charge_code, task_description, status, submitted_at)
        SELECT 
            id,
            hours,  -- This will read the computed value from the generated column
            date,
            project,
            tool,
            detail_charge_code,
            task_description,
            status,
            submitted_at
        FROM timesheet
    `);
}

export function replaceTimesheetTableAndIndexes(
  db: BetterSqlite3.Database
): void {
  db.exec(`DROP TABLE timesheet`);
  db.exec(`ALTER TABLE timesheet_new RENAME TO timesheet`);

  db.exec(`
        CREATE INDEX IF NOT EXISTS idx_timesheet_date ON timesheet(date);
        CREATE INDEX IF NOT EXISTS idx_timesheet_project ON timesheet(project);
        CREATE INDEX IF NOT EXISTS idx_timesheet_status ON timesheet(status);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_timesheet_nk
            ON timesheet(date, project, task_description)
            WHERE date IS NOT NULL 
              AND project IS NOT NULL 
              AND task_description IS NOT NULL
    `);
}

export function createBusinessConfigTables(db: BetterSqlite3.Database): void {
  db.exec(`
    -- Projects table
    CREATE TABLE IF NOT EXISTS business_config_projects(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      requires_tools BOOLEAN NOT NULL DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tools table
    CREATE TABLE IF NOT EXISTS business_config_tools(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      requires_charge_code BOOLEAN NOT NULL DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tools by project junction table
    CREATE TABLE IF NOT EXISTS business_config_tools_by_project(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES business_config_projects(id) ON DELETE CASCADE,
      tool_id INTEGER NOT NULL REFERENCES business_config_tools(id) ON DELETE CASCADE,
      display_order INTEGER DEFAULT 0,
      UNIQUE(project_id, tool_id)
    );

    -- Charge codes table
    CREATE TABLE IF NOT EXISTS business_config_charge_codes(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_business_config_projects_name ON business_config_projects(name);
    CREATE INDEX IF NOT EXISTS idx_business_config_projects_active ON business_config_projects(is_active);
    CREATE INDEX IF NOT EXISTS idx_business_config_tools_name ON business_config_tools(name);
    CREATE INDEX IF NOT EXISTS idx_business_config_tools_active ON business_config_tools(is_active);
    CREATE INDEX IF NOT EXISTS idx_business_config_tools_by_project_project ON business_config_tools_by_project(project_id);
    CREATE INDEX IF NOT EXISTS idx_business_config_tools_by_project_tool ON business_config_tools_by_project(tool_id);
    CREATE INDEX IF NOT EXISTS idx_business_config_charge_codes_name ON business_config_charge_codes(name);
    CREATE INDEX IF NOT EXISTS idx_business_config_charge_codes_active ON business_config_charge_codes(is_active);
  `);
}

export function seedBusinessConfigFromStatic(db: BetterSqlite3.Database): void {
  // Import static config - use dynamic import to avoid circular dependencies
  // We'll import it directly since it's in shared
  const {
    PROJECTS,
    PROJECTS_WITHOUT_TOOLS,
    TOOLS_WITHOUT_CHARGES,
    TOOLS_BY_PROJECT,
    CHARGE_CODES,
  } = require("@sheetpilot/shared/business-config");

  dbLogger.info("Migration 4: Seeding business configuration from static config");

  // Insert projects
  const insertProject = db.prepare(`
    INSERT OR IGNORE INTO business_config_projects (name, requires_tools, display_order, is_active)
    VALUES (?, ?, ?, 1)
  `);

  const projectsWithoutToolsSet = new Set(PROJECTS_WITHOUT_TOOLS);
  PROJECTS.forEach((project: string, index: number) => {
    const requiresTools = !projectsWithoutToolsSet.has(project);
    insertProject.run(project, requiresTools ? 1 : 0, index);
  });

  dbLogger.verbose("Migration 4: Projects seeded", { count: PROJECTS.length });

  // Insert tools (collect unique tools from all projects)
  const allToolsSet = new Set<string>();
  (Object.values(TOOLS_BY_PROJECT) as readonly string[][]).forEach((tools: readonly string[]) => {
    tools.forEach((tool: string) => allToolsSet.add(tool));
  });

  const insertTool = db.prepare(`
    INSERT OR IGNORE INTO business_config_tools (name, requires_charge_code, display_order, is_active)
    VALUES (?, ?, ?, 1)
  `);

  const toolsWithoutChargesSet = new Set(TOOLS_WITHOUT_CHARGES);
  const allToolsArray = Array.from(allToolsSet);
  allToolsArray.forEach((tool, index) => {
    const requiresChargeCode = !toolsWithoutChargesSet.has(tool);
    insertTool.run(tool, requiresChargeCode ? 1 : 0, index);
  });

  dbLogger.verbose("Migration 4: Tools seeded", { count: allToolsArray.length });

  // Link tools to projects
  const getProjectId = db.prepare(`
    SELECT id FROM business_config_projects WHERE name = ?
  `);

  const getToolId = db.prepare(`
    SELECT id FROM business_config_tools WHERE name = ?
  `);

  const insertToolProjectLink = db.prepare(`
    INSERT OR IGNORE INTO business_config_tools_by_project (project_id, tool_id, display_order)
    VALUES (?, ?, ?)
  `);

  let linkCount = 0;
  (Object.entries(TOOLS_BY_PROJECT) as Array<[string, readonly string[]]>).forEach(([projectName, tools]: [string, readonly string[]]) => {
    const projectRow = getProjectId.get(projectName) as { id: number } | undefined;
    if (!projectRow) {
      dbLogger.warn("Migration 4: Project not found for tool linking", {
        project: projectName,
      });
      return;
    }

    tools.forEach((toolName: string, toolIndex: number) => {
      const toolRow = getToolId.get(toolName) as { id: number } | undefined;
      if (!toolRow) {
        dbLogger.warn("Migration 4: Tool not found for project linking", {
          tool: toolName,
          project: projectName,
        });
        return;
      }

      insertToolProjectLink.run(projectRow.id, toolRow.id, toolIndex);
      linkCount++;
    });
  });

  dbLogger.verbose("Migration 4: Tool-project links seeded", { count: linkCount });

  // Insert charge codes
  const insertChargeCode = db.prepare(`
    INSERT OR IGNORE INTO business_config_charge_codes (name, display_order, is_active)
    VALUES (?, ?, 1)
  `);

  CHARGE_CODES.forEach((chargeCode: string, index: number) => {
    insertChargeCode.run(chargeCode, index);
  });

  dbLogger.verbose("Migration 4: Charge codes seeded", {
    count: CHARGE_CODES.length,
  });

  dbLogger.info("Migration 4: Business configuration seeding completed");
}
