/**
 * @fileoverview Business Configuration IPC Handlers Tests
 *
 * Tests for business configuration IPC handlers (read and admin write operations).
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { registerBusinessConfigHandlers } from "@/routes/business-config-handlers";
import {
  setDbPath,
  ensureSchema,
  shutdownDatabase,
  runMigrations,
  createSession,
} from "@/models";

// Mock Electron
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock logger
vi.mock("../../../shared/logger", () => ({
  ipcLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    verbose: vi.fn(),
    security: vi.fn(),
    audit: vi.fn(),
  },
  dbLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    verbose: vi.fn(),
    audit: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() })),
  },
}));

// Mock trusted sender check
vi.mock("../../src/routes/handlers/timesheet/main-window", () => ({
  isTrustedIpcSender: vi.fn(() => true),
}));

// Mock validation
vi.mock("../../src/validation/validate-ipc-input", () => ({
  validateInput: vi.fn((schema, data, channel) => ({
    success: true,
    data: data,
  })),
}));

describe("Business Config IPC Handlers", () => {
  let testDbPath: string;
  let originalDbPath: string;
  let adminToken: string;

  beforeEach(() => {
    originalDbPath = process.env["SHEETPILOT_DB_PATH"] || "";
    testDbPath = path.join(
      os.tmpdir(),
      `sheetpilot-bizconfig-ipc-test-${Date.now()}.sqlite`
    );
    setDbPath(testDbPath);
    ensureSchema();
    const db = require("../../src/models").getDb();
    runMigrations(db, testDbPath);

    // Create admin session
    const adminSession = createSession("admin@test.com", true);
    adminToken = adminSession;

    registerBusinessConfigHandlers();
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

    vi.clearAllMocks();
  });

  describe("Handler Registration", () => {
    it("should register all business config handlers", () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const channels = handleCalls.map((call) => call[0]);

      expect(channels).toContain("business-config:getAllProjects");
      expect(channels).toContain("business-config:getToolsForProject");
      expect(channels).toContain("business-config:updateProject");
    });
  });

  describe("Read Operations", () => {
    it("should handle getAllProjects", async () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const getAllProjectsCall = handleCalls.find(
        (call) => call[0] === "business-config:getAllProjects"
      );
      expect(getAllProjectsCall).toBeDefined();

      if (getAllProjectsCall) {
        const handler = getAllProjectsCall[1] as (
          event: unknown
        ) => Promise<unknown>;
        const result = (await handler({} as Electron.IpcMainInvokeEvent)) as {
          success: boolean;
          projects?: readonly string[];
          error?: string;
        };
        expect(result).toHaveProperty("success");
        expect(result.success).toBe(true);
        expect(result.projects).toBeDefined();
        expect(Array.isArray(result.projects)).toBe(true);
        if (result.projects) {
          expect(result.projects.length).toBeGreaterThan(0);
        }
      }
    });

    it("should handle getProjectsWithoutTools", async () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const call = handleCalls.find(
        (call) => call[0] === "business-config:getProjectsWithoutTools"
      );
      expect(call).toBeDefined();

      if (call) {
        const handler = call[1] as (event: unknown) => Promise<unknown>;
        const result = (await handler({} as Electron.IpcMainInvokeEvent)) as {
          success: boolean;
          projects?: readonly string[];
          error?: string;
        };
        expect(result.success).toBe(true);
        expect(result.projects).toBeDefined();
        expect(Array.isArray(result.projects)).toBe(true);
      }
    });

    it("should handle getToolsForProject", async () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const call = handleCalls.find(
        (call) => call[0] === "business-config:getToolsForProject"
      );
      expect(call).toBeDefined();

      if (call) {
        const handler = call[1] as (
          event: unknown,
          project: string
        ) => Promise<unknown>;
        // Get a real project from the database
        const {
          getAllProjects,
        } = require("../../src/models/business-config.service");
        const projects = await getAllProjects();
        if (projects.length > 0) {
          const result = (await handler(
            {} as Electron.IpcMainInvokeEvent,
            projects[0]
          )) as {
            success: boolean;
            tools?: readonly string[];
            error?: string;
          };
          expect(result.success).toBe(true);
          expect(result.tools).toBeDefined();
          expect(Array.isArray(result.tools)).toBe(true);
        }
      }
    });

    it("should handle getAllTools", async () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const call = handleCalls.find(
        (call) => call[0] === "business-config:getAllTools"
      );
      expect(call).toBeDefined();

      if (call) {
        const handler = call[1] as (event: unknown) => Promise<unknown>;
        const result = (await handler({} as Electron.IpcMainInvokeEvent)) as {
          success: boolean;
          tools?: readonly string[];
          error?: string;
        };
        expect(result.success).toBe(true);
        expect(result.tools).toBeDefined();
        expect(Array.isArray(result.tools)).toBe(true);
      }
    });

    it("should handle getAllChargeCodes", async () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const call = handleCalls.find(
        (call) => call[0] === "business-config:getAllChargeCodes"
      );
      expect(call).toBeDefined();

      if (call) {
        const handler = call[1] as (event: unknown) => Promise<unknown>;
        const result = (await handler({} as Electron.IpcMainInvokeEvent)) as {
          success: boolean;
          chargeCodes?: readonly string[];
          error?: string;
        };
        expect(result.success).toBe(true);
        expect(result.chargeCodes).toBeDefined();
        expect(Array.isArray(result.chargeCodes)).toBe(true);
      }
    });

    it("should handle validateProject", async () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const call = handleCalls.find(
        (call) => call[0] === "business-config:validateProject"
      );
      expect(call).toBeDefined();

      if (call) {
        const handler = call[1] as (
          event: unknown,
          project: string
        ) => Promise<unknown>;
        const {
          getAllProjects,
        } = require("../../src/models/business-config.service");
        const projects = await getAllProjects();
        if (projects.length > 0) {
          const result = (await handler(
            {} as Electron.IpcMainInvokeEvent,
            projects[0]
          )) as {
            success: boolean;
            isValid?: boolean;
            error?: string;
          };
          expect(result.success).toBe(true);
          expect(result.isValid).toBe(true);
        }

        // Test invalid project
        const invalidResult = (await handler(
          {} as Electron.IpcMainInvokeEvent,
          "Non-existent Project"
        )) as {
          success: boolean;
          isValid?: boolean;
          error?: string;
        };
        expect(invalidResult.success).toBe(true);
        expect(invalidResult.isValid).toBe(false);
      }
    });
  });

  describe("Admin Write Operations", () => {
    it("should register admin update handlers", () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const channels = handleCalls.map((call) => call[0]);

      expect(channels).toContain("business-config:updateProject");
      expect(channels).toContain("business-config:addProject");
      expect(channels).toContain("business-config:linkToolToProject");
    });

    it("should handle addProject with admin token", async () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const call = handleCalls.find(
        (call) => call[0] === "business-config:addProject"
      );
      expect(call).toBeDefined();

      if (call) {
        const handler = call[1] as (
          event: unknown,
          token: string,
          project: Record<string, unknown>
        ) => Promise<unknown>;
        const result = (await handler(
          {} as Electron.IpcMainInvokeEvent,
          adminToken,
          {
            name: "IPC Test Project",
            requires_tools: true,
          }
        )) as {
          success: boolean;
          id?: number;
          error?: string;
        };
        expect(result.success).toBe(true);
        expect(result.id).toBeDefined();
        expect(typeof result.id).toBe("number");
      }
    });

    it("should reject addProject without admin token", async () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const call = handleCalls.find(
        (call) => call[0] === "business-config:addProject"
      );

      if (call) {
        const handler = call[1] as (
          event: unknown,
          token: string,
          project: Record<string, unknown>
        ) => Promise<unknown>;
        // Create non-admin session
        const { createSession } = require("../../src/models");
        const nonAdminSession = createSession("user@test.com", false);

        const result = (await handler(
          {} as Electron.IpcMainInvokeEvent,
          nonAdminSession.token,
          {
            name: "Unauthorized Test Project",
            requires_tools: true,
          }
        )) as {
          success: boolean;
          error?: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toContain("Admin access required");
      }
    });

    it("should handle updateProject with admin token", async () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const addCall = handleCalls.find(
        (call) => call[0] === "business-config:addProject"
      );
      const updateCall = handleCalls.find(
        (call) => call[0] === "business-config:updateProject"
      );

      if (addCall && updateCall) {
        const addHandler = addCall[1] as (
          event: unknown,
          token: string,
          project: Record<string, unknown>
        ) => Promise<unknown>;
        const addResult = (await addHandler(
          {} as Electron.IpcMainInvokeEvent,
          adminToken,
          {
            name: "Update IPC Test Project",
            requires_tools: true,
          }
        )) as {
          success: boolean;
          id?: number;
          error?: string;
        };

        if (addResult.success && addResult.id) {
          const updateHandler = updateCall[1] as (
            event: unknown,
            token: string,
            id: number,
            updates: Record<string, unknown>
          ) => Promise<unknown>;
          const updateResult = (await updateHandler(
            {} as Electron.IpcMainInvokeEvent,
            adminToken,
            addResult.id,
            {
              requires_tools: false,
            }
          )) as {
            success: boolean;
            error?: string;
          };
          expect(updateResult.success).toBe(true);
        }
      }
    });

    it("should handle linkToolToProject with admin token", async () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const addProjectCall = handleCalls.find(
        (call) => call[0] === "business-config:addProject"
      );
      const addToolCall = handleCalls.find(
        (call) => call[0] === "business-config:addTool"
      );
      const linkCall = handleCalls.find(
        (call) => call[0] === "business-config:linkToolToProject"
      );

      if (addProjectCall && addToolCall && linkCall) {
        const addProjectHandler = addProjectCall[1] as (
          event: unknown,
          token: string,
          project: Record<string, unknown>
        ) => Promise<unknown>;
        const addToolHandler = addToolCall[1] as (
          event: unknown,
          token: string,
          tool: Record<string, unknown>
        ) => Promise<unknown>;
        const linkHandler = linkCall[1] as (
          event: unknown,
          token: string,
          projectId: number,
          toolId: number,
          displayOrder?: number
        ) => Promise<unknown>;

        const projectResult = (await addProjectHandler(
          {} as Electron.IpcMainInvokeEvent,
          adminToken,
          {
            name: "Link Test Project",
            requires_tools: true,
          }
        )) as {
          success: boolean;
          id?: number;
          error?: string;
        };

        const toolResult = (await addToolHandler(
          {} as Electron.IpcMainInvokeEvent,
          adminToken,
          {
            name: "Link Test Tool",
            requires_charge_code: true,
          }
        )) as {
          success: boolean;
          id?: number;
          error?: string;
        };

        if (
          projectResult.success &&
          projectResult.id &&
          toolResult.success &&
          toolResult.id
        ) {
          const linkResult = (await linkHandler(
            {} as Electron.IpcMainInvokeEvent,
            adminToken,
            projectResult.id,
            toolResult.id,
            5
          )) as {
            success: boolean;
            error?: string;
          };
          expect(linkResult.success).toBe(true);
        }
      }
    });
  });

  describe("Validation", () => {
    it("should validate input for getToolsForProject", async () => {
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const call = handleCalls.find(
        (call) => call[0] === "business-config:getToolsForProject"
      );

      if (call) {
        const handler = call[1] as (
          event: unknown,
          project: string
        ) => Promise<unknown>;
        // Test with empty string (should fail validation)
        const result = (await handler(
          {} as Electron.IpcMainInvokeEvent,
          ""
        )) as {
          success: boolean;
          error?: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });
});
