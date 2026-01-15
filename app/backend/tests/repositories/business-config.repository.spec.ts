/**
 * @fileoverview Business Configuration Repository Unit Tests
 *
 * Tests for business configuration CRUD operations and relationship management.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  getAllProjects,
  getProjectsWithoutTools,
  getAllTools,
  getToolsWithoutChargeCodes,
  getToolsByProject,
  getAllChargeCodes,
  addProject,
  addTool,
  addChargeCode,
  updateProject,
  updateTool,
  updateChargeCode,
  linkToolToProject,
  unlinkToolFromProject,
} from "../../src/models/business-config.repository";
import {
  setDbPath,
  ensureSchema,
  shutdownDatabase,
  runMigrations,
} from "../../src/models";

// Mock logger before importing repository
vi.mock("../../../shared/logger", () => ({
  dbLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    verbose: vi.fn(),
    audit: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() })),
  },
}));

describe("Business Config Repository", () => {
  let testDbPath: string;
  let originalDbPath: string;

  beforeEach(() => {
    originalDbPath = process.env["SHEETPILOT_DB_PATH"] || "";
    testDbPath = path.join(
      os.tmpdir(),
      `sheetpilot-bizconfig-test-${Date.now()}.sqlite`
    );
    setDbPath(testDbPath);
    ensureSchema();
    // Run migrations to create business config tables
    const db = require("../../src/models").getDb();
    runMigrations(db, testDbPath);
  });

  afterEach(() => {
    try {
      shutdownDatabase();
    } catch {
      // Ignore if not exists
    }

    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    if (originalDbPath) {
      setDbPath(originalDbPath);
    }
  });

  describe("Projects", () => {
    it("should get all projects after migration", () => {
      const projects = getAllProjects();
      expect(projects.length).toBeGreaterThan(0);
      expect(projects[0]).toHaveProperty("name");
      expect(projects[0]).toHaveProperty("requires_tools");
      expect(projects[0]).toHaveProperty("is_active");
      expect(projects[0]).toHaveProperty("display_order");
    });

    it("should only return active projects", () => {
      const id = addProject({
        name: "Inactive Test Project",
        requires_tools: true,
        is_active: false,
      });

      const projects = getAllProjects();
      const inactiveProject = projects.find((p) => p.id === id);
      expect(inactiveProject).toBeUndefined();
    });

    it("should get projects without tools", () => {
      const projects = getProjectsWithoutTools();
      expect(Array.isArray(projects)).toBe(true);
      projects.forEach((project) => {
        const projectEntity = getAllProjects().find((p) => p.name === project);
        expect(projectEntity?.requires_tools).toBe(false);
      });
    });

    it("should add a new project", () => {
      const id = addProject({
        name: "Test Project",
        requires_tools: true,
      });
      expect(id).toBeGreaterThan(0);

      const projects = getAllProjects();
      const testProject = projects.find((p) => p.name === "Test Project");
      expect(testProject).toBeDefined();
      expect(testProject?.requires_tools).toBe(true);
      expect(testProject?.is_active).toBe(true);
    });

    it("should add project with default values", () => {
      const id = addProject({
        name: "Default Values Project",
      });
      expect(id).toBeGreaterThan(0);

      const projects = getAllProjects();
      const project = projects.find((p) => p.id === id);
      expect(project?.requires_tools).toBe(true);
      expect(project?.is_active).toBe(true);
      expect(project?.display_order).toBe(0);
    });

    it("should update a project", () => {
      const id = addProject({
        name: "Update Test Project",
        requires_tools: true,
      });

      updateProject(id, {
        requires_tools: false,
        display_order: 10,
      });

      const projects = getAllProjects();
      const updated = projects.find((p) => p.id === id);
      expect(updated?.requires_tools).toBe(false);
      expect(updated?.display_order).toBe(10);
    });

    it("should update project name", () => {
      const id = addProject({
        name: "Original Name",
        requires_tools: true,
      });

      updateProject(id, {
        name: "Updated Name",
      });

      const projects = getAllProjects();
      const updated = projects.find((p) => p.id === id);
      expect(updated?.name).toBe("Updated Name");
    });

    it("should deactivate a project", () => {
      const id = addProject({
        name: "Deactivate Test Project",
        requires_tools: true,
      });

      updateProject(id, {
        is_active: false,
      });

      const projects = getAllProjects();
      const deactivated = projects.find((p) => p.id === id);
      expect(deactivated).toBeUndefined();
    });

    it("should handle partial updates", () => {
      const id = addProject({
        name: "Partial Update Project",
        requires_tools: true,
        display_order: 5,
      });

      updateProject(id, {
        display_order: 15,
      });

      const projects = getAllProjects();
      const updated = projects.find((p) => p.id === id);
      expect(updated?.requires_tools).toBe(true);
      expect(updated?.display_order).toBe(15);
    });
  });

  describe("Tools", () => {
    it("should get all tools after migration", () => {
      const tools = getAllTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0]).toHaveProperty("name");
      expect(tools[0]).toHaveProperty("requires_charge_code");
      expect(tools[0]).toHaveProperty("is_active");
    });

    it("should only return active tools", () => {
      const id = addTool({
        name: "Inactive Test Tool",
        requires_charge_code: true,
        is_active: false,
      });

      const tools = getAllTools();
      const inactiveTool = tools.find((t) => t.id === id);
      expect(inactiveTool).toBeUndefined();
    });

    it("should get tools without charge codes", () => {
      const tools = getToolsWithoutChargeCodes();
      expect(Array.isArray(tools)).toBe(true);
      tools.forEach((tool) => {
        const toolEntity = getAllTools().find((t) => t.name === tool);
        expect(toolEntity?.requires_charge_code).toBe(false);
      });
    });

    it("should add a new tool", () => {
      const id = addTool({
        name: "Test Tool",
        requires_charge_code: true,
      });
      expect(id).toBeGreaterThan(0);

      const tools = getAllTools();
      const testTool = tools.find((t) => t.name === "Test Tool");
      expect(testTool).toBeDefined();
      expect(testTool?.requires_charge_code).toBe(true);
    });

    it("should add tool with default values", () => {
      const id = addTool({
        name: "Default Values Tool",
      });
      expect(id).toBeGreaterThan(0);

      const tools = getAllTools();
      const tool = tools.find((t) => t.id === id);
      expect(tool?.requires_charge_code).toBe(true);
      expect(tool?.is_active).toBe(true);
      expect(tool?.display_order).toBe(0);
    });

    it("should update a tool", () => {
      const id = addTool({
        name: "Update Test Tool",
        requires_charge_code: true,
      });

      updateTool(id, {
        requires_charge_code: false,
        display_order: 20,
      });

      const tools = getAllTools();
      const updated = tools.find((t) => t.id === id);
      expect(updated?.requires_charge_code).toBe(false);
      expect(updated?.display_order).toBe(20);
    });

    it("should update tool name", () => {
      const id = addTool({
        name: "Original Tool Name",
        requires_charge_code: true,
      });

      updateTool(id, {
        name: "Updated Tool Name",
      });

      const tools = getAllTools();
      const updated = tools.find((t) => t.id === id);
      expect(updated?.name).toBe("Updated Tool Name");
    });

    it("should deactivate a tool", () => {
      const id = addTool({
        name: "Deactivate Test Tool",
        requires_charge_code: true,
      });

      updateTool(id, {
        is_active: false,
      });

      const tools = getAllTools();
      const deactivated = tools.find((t) => t.id === id);
      expect(deactivated).toBeUndefined();
    });
  });

  describe("Charge Codes", () => {
    it("should get all charge codes after migration", () => {
      const chargeCodes = getAllChargeCodes();
      expect(chargeCodes.length).toBeGreaterThan(0);
    });

    it("should only return active charge codes", () => {
      const id = addChargeCode({
        name: "Inactive Test Charge Code",
        is_active: false,
      });

      const chargeCodes = getAllChargeCodes();
      const inactiveCode = chargeCodes.find((c) => c === "Inactive Test Charge Code");
      expect(inactiveCode).toBeUndefined();
    });

    it("should add a new charge code", () => {
      const id = addChargeCode({
        name: "Test Charge Code",
      });
      expect(id).toBeGreaterThan(0);

      const chargeCodes = getAllChargeCodes();
      expect(chargeCodes).toContain("Test Charge Code");
    });

    it("should add charge code with default values", () => {
      const id = addChargeCode({
        name: "Default Values Charge Code",
      });
      expect(id).toBeGreaterThan(0);

      const db = require("../../src/models").getDb();
      const stmt = db.prepare("SELECT * FROM business_config_charge_codes WHERE id = ?");
      const chargeCode = stmt.get(id) as {
        name: string;
        is_active: number;
        display_order: number;
      };
      expect(chargeCode.is_active).toBe(1);
      expect(chargeCode.display_order).toBe(0);
    });

    it("should update a charge code", () => {
      const id = addChargeCode({
        name: "Update Test Charge Code",
        display_order: 5,
      });

      const db = require("../../src/models").getDb();
      updateChargeCode(id, {
        display_order: 25,
        is_active: false,
      });

      const stmt = db.prepare("SELECT * FROM business_config_charge_codes WHERE id = ?");
      const updated = stmt.get(id) as { display_order: number; is_active: number };
      expect(updated.display_order).toBe(25);
      expect(updated.is_active).toBe(0);
    });
  });

  describe("Tool-Project Relationships", () => {
    it("should link a tool to a project", () => {
      const projectId = addProject({
        name: "Relationship Test Project",
        requires_tools: true,
      });
      const toolId = addTool({
        name: "Relationship Test Tool",
        requires_charge_code: true,
      });

      linkToolToProject(projectId, toolId);

      const tools = getToolsByProject("Relationship Test Project");
      expect(tools).toContain("Relationship Test Tool");
    });

    it("should link multiple tools to a project", () => {
      const projectId = addProject({
        name: "Multi Tool Project",
        requires_tools: true,
      });
      const tool1Id = addTool({ name: "Tool 1", requires_charge_code: true });
      const tool2Id = addTool({ name: "Tool 2", requires_charge_code: true });
      const tool3Id = addTool({ name: "Tool 3", requires_charge_code: true });

      linkToolToProject(projectId, tool1Id, 1);
      linkToolToProject(projectId, tool2Id, 2);
      linkToolToProject(projectId, tool3Id, 3);

      const tools = getToolsByProject("Multi Tool Project");
      expect(tools.length).toBe(3);
      expect(tools).toContain("Tool 1");
      expect(tools).toContain("Tool 2");
      expect(tools).toContain("Tool 3");
    });

    it("should handle duplicate link attempts (upsert)", () => {
      const projectId = addProject({
        name: "Duplicate Link Project",
        requires_tools: true,
      });
      const toolId = addTool({
        name: "Duplicate Link Tool",
        requires_charge_code: true,
      });

      linkToolToProject(projectId, toolId, 5);
      linkToolToProject(projectId, toolId, 10); // Should update display_order

      const tools = getToolsByProject("Duplicate Link Project");
      expect(tools).toContain("Duplicate Link Tool");
      expect(tools.length).toBe(1); // Should not duplicate
    });

    it("should unlink a tool from a project", () => {
      const projectId = addProject({
        name: "Unlink Test Project",
        requires_tools: true,
      });
      const toolId = addTool({
        name: "Unlink Test Tool",
        requires_charge_code: true,
      });

      linkToolToProject(projectId, toolId);
      let tools = getToolsByProject("Unlink Test Project");
      expect(tools).toContain("Unlink Test Tool");

      unlinkToolFromProject(projectId, toolId);
      tools = getToolsByProject("Unlink Test Project");
      expect(tools).not.toContain("Unlink Test Tool");
    });

    it("should return empty array for project without tools", () => {
      const projectId = addProject({
        name: "No Tools Project",
        requires_tools: false,
      });

      const tools = getToolsByProject("No Tools Project");
      expect(tools).toEqual([]);
    });

    it("should return empty array for non-existent project", () => {
      const tools = getToolsByProject("Non-existent Project");
      expect(tools).toEqual([]);
    });

    it("should only return active tools for a project", () => {
      const projectId = addProject({
        name: "Active Tools Only Project",
        requires_tools: true,
      });
      const activeToolId = addTool({
        name: "Active Tool",
        requires_charge_code: true,
        is_active: true,
      });
      const inactiveToolId = addTool({
        name: "Inactive Tool",
        requires_charge_code: true,
        is_active: false,
      });

      linkToolToProject(projectId, activeToolId);
      linkToolToProject(projectId, inactiveToolId);

      const tools = getToolsByProject("Active Tools Only Project");
      expect(tools).toContain("Active Tool");
      expect(tools).not.toContain("Inactive Tool");
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty results gracefully", () => {
      const db = require("../../src/models").getDb();
      // Create a fresh database without migration seed
      db.exec("DELETE FROM business_config_projects");
      db.exec("DELETE FROM business_config_tools");
      db.exec("DELETE FROM business_config_charge_codes");

      expect(getAllProjects()).toEqual([]);
      expect(getAllTools()).toEqual([]);
      expect(getAllChargeCodes()).toEqual([]);
      expect(getProjectsWithoutTools()).toEqual([]);
      expect(getToolsWithoutChargeCodes()).toEqual([]);
    });

    it("should handle projects with same name constraint", () => {
      addProject({
        name: "Duplicate Name Test",
        requires_tools: true,
      });

      expect(() => {
        addProject({
          name: "Duplicate Name Test",
          requires_tools: false,
        });
      }).toThrow();
    });

    it("should handle tools with same name constraint", () => {
      addTool({
        name: "Duplicate Tool Name",
        requires_charge_code: true,
      });

      expect(() => {
        addTool({
          name: "Duplicate Tool Name",
          requires_charge_code: false,
        });
      }).toThrow();
    });

    it("should handle charge codes with same name constraint", () => {
      addChargeCode({
        name: "Duplicate Charge Code",
      });

      expect(() => {
        addChargeCode({
          name: "Duplicate Charge Code",
        });
      }).toThrow();
    });
  });
});
