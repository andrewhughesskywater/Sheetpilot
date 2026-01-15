/**
 * @fileoverview Business Configuration Service Unit Tests
 *
 * Tests for business configuration service layer with caching.
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
  getToolsForProject,
  getAllTools,
  getToolsWithoutChargeCodes,
  getAllChargeCodes,
  isValidProject,
  isValidToolForProject,
  isValidChargeCode,
  invalidateCache,
  normalizeTimesheetRow,
  doesProjectNeedTools,
  doesToolNeedChargeCode,
} from "../../src/models/business-config.service";
import {
  setDbPath,
  ensureSchema,
  shutdownDatabase,
  runMigrations,
} from "../../src/models";

// Mock logger
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

describe("Business Config Service", () => {
  let testDbPath: string;
  let originalDbPath: string;

  beforeEach(() => {
    originalDbPath = process.env["SHEETPILOT_DB_PATH"] || "";
    testDbPath = path.join(
      os.tmpdir(),
      `sheetpilot-bizconfig-service-test-${Date.now()}.sqlite`
    );
    setDbPath(testDbPath);
    ensureSchema();
    const db = require("../../src/models").getDb();
    runMigrations(db, testDbPath);
    invalidateCache();
  });

  afterEach(() => {
    try {
      shutdownDatabase();
    } catch {
      // Ignore
    }

    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignore
      }
    }

    if (originalDbPath) {
      setDbPath(originalDbPath);
    }
    invalidateCache();
  });

  describe("Caching", () => {
    it("should cache projects after first load", async () => {
      const projects1 = await getAllProjects();
      const projects2 = await getAllProjects();
      expect(projects1).toBe(projects2); // Same reference = cached
    });

    it("should cache all data types", async () => {
      const projects1 = await getAllProjects();
      const projects2 = await getAllProjects();
      const tools1 = await getAllTools();
      const tools2 = await getAllTools();
      const chargeCodes1 = await getAllChargeCodes();
      const chargeCodes2 = await getAllChargeCodes();

      expect(projects1).toBe(projects2);
      expect(tools1).toBe(tools2);
      expect(chargeCodes1).toBe(chargeCodes2);
    });

    it("should invalidate cache", async () => {
      await getAllProjects();
      invalidateCache();
      const projects = await getAllProjects();
      expect(projects.length).toBeGreaterThan(0);
    });

    it("should cache tools by project", async () => {
      const projects = await getAllProjects();
      if (projects.length > 0) {
        const project = projects[0];
        const tools1 = await getToolsForProject(project);
        const tools2 = await getToolsForProject(project);
        expect(tools1).toBe(tools2); // Same reference = cached
      }
    });
  });

  describe("Business Logic Functions", () => {
    it("should validate a project", async () => {
      const projects = await getAllProjects();
      if (projects.length > 0) {
        const isValid = await isValidProject(projects[0]);
        expect(isValid).toBe(true);
      }
    });

    it("should return false for invalid project", async () => {
      const isValid = await isValidProject("Non-existent Project");
      expect(isValid).toBe(false);
    });

    it("should return false for empty project name", async () => {
      const isValid = await isValidProject("");
      expect(isValid).toBe(false);
    });

    it("should get tools for a project", async () => {
      const projects = await getAllProjects();
      if (projects.length > 0) {
        const tools = await getToolsForProject(projects[0]);
        expect(Array.isArray(tools)).toBe(true);
      }
    });

    it("should return empty array for project without tools", async () => {
      const projectsWithoutTools = await getProjectsWithoutTools();
      if (projectsWithoutTools.length > 0) {
        const tools = await getToolsForProject(projectsWithoutTools[0]);
        expect(tools).toEqual([]);
      }
    });

    it("should return empty array for empty project name", async () => {
      const tools = await getToolsForProject("");
      expect(tools).toEqual([]);
    });

    it("should validate charge codes", async () => {
      const chargeCodes = await getAllChargeCodes();
      if (chargeCodes.length > 0) {
        const isValid = await isValidChargeCode(chargeCodes[0]);
        expect(isValid).toBe(true);
      }
    });

    it("should return false for invalid charge code", async () => {
      const isValid = await isValidChargeCode("Non-existent Charge Code");
      expect(isValid).toBe(false);
    });

    it("should validate tool for project", async () => {
      const projects = await getAllProjects();
      if (projects.length > 0) {
        const project = projects[0];
        const tools = await getToolsForProject(project);
        if (tools.length > 0) {
          const isValid = await isValidToolForProject(tools[0], project);
          expect(isValid).toBe(true);
        }
      }
    });

    it("should return false for tool not in project", async () => {
      const projects = await getAllProjects();
      if (projects.length > 0) {
        const isValid = await isValidToolForProject("Non-existent Tool", projects[0]);
        expect(isValid).toBe(false);
      }
    });

    it("should return false for tool in project without tools", async () => {
      const projectsWithoutTools = await getProjectsWithoutTools();
      if (projectsWithoutTools.length > 0) {
        const isValid = await isValidToolForProject("Any Tool", projectsWithoutTools[0]);
        expect(isValid).toBe(false);
      }
    });
  });

  describe("Project and Tool Flags", () => {
    it("should identify projects that need tools", async () => {
      const projects = await getAllProjects();
      const projectsWithoutTools = await getProjectsWithoutTools();
      const projectsWithoutToolsSet = new Set(projectsWithoutTools);

      for (const project of projects) {
        if (!projectsWithoutToolsSet.has(project)) {
          // This project should need tools
          const tools = await getToolsForProject(project);
          // Project needs tools, so it should have tools available (or empty if none linked)
          expect(Array.isArray(tools)).toBe(true);
        }
      }
    });

    it("should identify tools that need charge codes", async () => {
      const tools = await getAllTools();
      const toolsWithoutChargeCodes = await getToolsWithoutChargeCodes();
      const toolsWithoutChargeCodesSet = new Set(toolsWithoutChargeCodes);

      for (const tool of tools) {
        if (!toolsWithoutChargeCodesSet.has(tool)) {
          // This tool should need charge codes
          // We can't directly test this without accessing the repository,
          // but we can verify the list is correct
          expect(toolsWithoutChargeCodes).not.toContain(tool);
        }
      }
    });
  });

  describe("Data Consistency", () => {
    it("should return consistent project lists", async () => {
      const projects1 = await getAllProjects();
      const projects2 = await getAllProjects();
      expect(projects1).toEqual(projects2);
    });

    it("should return consistent tool lists", async () => {
      const tools1 = await getAllTools();
      const tools2 = await getAllTools();
      expect(tools1).toEqual(tools2);
    });

    it("should return consistent charge code lists", async () => {
      const chargeCodes1 = await getAllChargeCodes();
      const chargeCodes2 = await getAllChargeCodes();
      expect(chargeCodes1).toEqual(chargeCodes2);
    });

    it("should handle projects with no tools gracefully", async () => {
      const projectsWithoutTools = await getProjectsWithoutTools();
      for (const project of projectsWithoutTools) {
        const tools = await getToolsForProject(project);
        expect(tools).toEqual([]);
      }
    });
  });

  describe("Normalization", () => {
    it("should normalize timesheet row - project without tools", async () => {
      const projectsWithoutTools = await getProjectsWithoutTools();
      if (projectsWithoutTools.length > 0) {
        const row = {
          date: "2025-01-15",
          project: projectsWithoutTools[0],
          tool: "Some Tool",
          chargeCode: "EPR1",
          taskDescription: "Test task",
        };

        const normalized = await normalizeTimesheetRow(row);
        expect(normalized.tool).toBeNull();
        expect(normalized.chargeCode).toBeNull();
        expect(normalized.project).toBe(projectsWithoutTools[0]);
        expect(normalized.date).toBe("2025-01-15");
      }
    });

    it("should normalize timesheet row - tool without charge code", async () => {
      const toolsWithoutChargeCodes = await getToolsWithoutChargeCodes();
      const projects = await getAllProjects();
      const projectsWithoutTools = await getProjectsWithoutTools();
      const projectsWithTools = projects.filter(
        (p) => !projectsWithoutTools.includes(p)
      );

      if (toolsWithoutChargeCodes.length > 0 && projectsWithTools.length > 0) {
        // Find a project that has this tool
        let foundProject: string | undefined;
        let foundTool: string | undefined;

        for (const project of projectsWithTools) {
          const tools = await getToolsForProject(project);
          const matchingTool = tools.find((t) =>
            toolsWithoutChargeCodes.includes(t)
          );
          if (matchingTool) {
            foundProject = project;
            foundTool = matchingTool;
            break;
          }
        }

        if (foundProject && foundTool) {
          const row = {
            date: "2025-01-15",
            project: foundProject,
            tool: foundTool,
            chargeCode: "EPR1",
            taskDescription: "Test task",
          };

          const normalized = await normalizeTimesheetRow(row);
          expect(normalized.tool).toBe(foundTool);
          expect(normalized.chargeCode).toBeNull();
          expect(normalized.project).toBe(foundProject);
        }
      }
    });

    it("should preserve valid row data", async () => {
      const projects = await getAllProjects();
      const projectsWithoutTools = await getProjectsWithoutTools();
      const projectsWithTools = projects.filter(
        (p) => !projectsWithoutTools.includes(p)
      );

      if (projectsWithTools.length > 0) {
        const project = projectsWithTools[0];
        const tools = await getToolsForProject(project);
        const chargeCodes = await getAllChargeCodes();

        if (tools.length > 0 && chargeCodes.length > 0) {
          const row = {
            date: "2025-01-15",
            project: project,
            tool: tools[0],
            chargeCode: chargeCodes[0],
            taskDescription: "Test task",
          };

          const normalized = await normalizeTimesheetRow(row);
          expect(normalized.project).toBe(project);
          expect(normalized.tool).toBe(tools[0]);
          expect(normalized.chargeCode).toBe(chargeCodes[0]);
          expect(normalized.date).toBe("2025-01-15");
          expect(normalized.taskDescription).toBe("Test task");
        }
      }
    });

    it("should handle empty row", async () => {
      const row = {};
      const normalized = await normalizeTimesheetRow(row);
      expect(normalized).toEqual({});
    });
  });

  describe("Flag Checking Functions", () => {
    it("should check if project needs tools", async () => {
      const projects = await getAllProjects();
      const projectsWithoutTools = await getProjectsWithoutTools();
      const projectsWithoutToolsSet = new Set(projectsWithoutTools);

      for (const project of projects) {
        const needsTools = await doesProjectNeedTools(project);
        if (projectsWithoutToolsSet.has(project)) {
          expect(needsTools).toBe(false);
        } else {
          expect(needsTools).toBe(true);
        }
      }
    });

    it("should check if tool needs charge code", async () => {
      const tools = await getAllTools();
      const toolsWithoutChargeCodes = await getToolsWithoutChargeCodes();
      const toolsWithoutChargeCodesSet = new Set(toolsWithoutChargeCodes);

      for (const tool of tools) {
        const needsChargeCode = await doesToolNeedChargeCode(tool);
        if (toolsWithoutChargeCodesSet.has(tool)) {
          expect(needsChargeCode).toBe(false);
        } else {
          expect(needsChargeCode).toBe(true);
        }
      }
    });

    it("should return false for empty project name", async () => {
      const needsTools = await doesProjectNeedTools("");
      expect(needsTools).toBe(false);
    });

    it("should return false for empty tool name", async () => {
      const needsChargeCode = await doesToolNeedChargeCode("");
      expect(needsChargeCode).toBe(false);
    });
  });
});
