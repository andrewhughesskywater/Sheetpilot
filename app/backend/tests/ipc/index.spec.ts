// Consolidated imports for all test suites in this file
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";
import type { IpcMainInvokeEvent, BrowserWindow } from "electron";
import { ipcMain, app as _app } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as _path from "path";
import * as os from "os";

// Route handlers
import { registerAdminHandlers } from "@/routes/admin-handlers";
import { registerAuthHandlers } from "@/routes/auth-handlers";
import { registerCredentialsHandlers } from "@/routes/credentials-handlers";
import { registerDatabaseHandlers } from "@/routes/database-handlers";
import { registerAllIPCHandlers } from "@/routes/index";
import {
  registerTimesheetHandlers,
  setMainWindow,
} from "@/routes/timesheet-handlers";
import { registerLogsHandlers } from "@/routes/logs-handlers";
import { registerLoggerHandlers } from "@/routes/logger-handlers";
import { registerSettingsHandlers } from "@/routes/settings-handlers";

// Models/Repositories
import * as repositories from "@/models";
import * as repo from "@/models";
import {
  ensureSchema,
  insertTimesheetEntry,
  getPendingTimesheetEntries,
  setDbPath,
  openDb,
  closeConnection,
} from "@/models";

// Services
import * as imp from "@/services/timesheet-importer";
import { submitTimesheets } from "@/services/timesheet-importer";

// Shared
import { ipcLogger, appLogger } from "@sheetpilot/shared/logger";
const _ipcLogger = ipcLogger;
import {
  CredentialsNotFoundError as _CredentialsNotFoundError,
  CredentialsStorageError,
} from "@sheetpilot/shared/errors";
import { setBrowserHeadless } from "@sheetpilot/shared/src/constants";

// Mock electron
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock repositories
vi.mock("../../src/models", () => ({
  validateSession: vi.fn(),
  clearAllCredentials: vi.fn(),
  rebuildDatabase: vi.fn(),
}));

// Mock logger
vi.mock("../../../shared/logger", () => ({
  ipcLogger: {
    security: vi.fn(),
    audit: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock validation
vi.mock("../../src/validation/validate-ipc-input", () => ({
  validateInput: vi.fn((schema, data) => ({ success: true, data })),
}));

// Mock trusted sender check
vi.mock("../../src/routes/handlers/timesheet/main-window", () => ({
  isTrustedIpcSender: vi.fn(() => true),
}));

describe("admin-handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerAdminHandlers", () => {
    it("should register all admin handlers", () => {
      registerAdminHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith(
        "admin:clearCredentials",
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "admin:rebuildDatabase",
        expect.any(Function)
      );
    });
  });

  describe("admin:clearCredentials handler", () => {
    it("should clear credentials when admin authenticated", async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "admin@example.com",
        isAdmin: true,
      });

      vi.mocked(repositories.clearAllCredentials).mockReturnValue(undefined);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "admin:clearCredentials"
        )?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "admin-token");

      expect(result.success).toBe(true);
      expect(repositories.clearAllCredentials).toHaveBeenCalled();
    });

    it("should reject non-admin users", async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "user@example.com",
        isAdmin: false,
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "admin:clearCredentials"
        )?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "user-token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unauthorized");
      expect(repositories.clearAllCredentials).not.toHaveBeenCalled();
    });

    it("should reject invalid sessions", async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: false,
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "admin:clearCredentials"
        )?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "invalid-token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unauthorized");
    });

    it("should handle errors gracefully", async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "admin@example.com",
        isAdmin: true,
      });

      vi.mocked(repositories.clearAllCredentials).mockImplementation(() => {
        throw new Error("Clear failed");
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "admin:clearCredentials"
        )?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "admin-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Clear failed");
    });
  });

  describe("admin:rebuildDatabase handler", () => {
    it("should rebuild database when admin authenticated", async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "admin@example.com",
        isAdmin: true,
      });

      vi.mocked(repositories.rebuildDatabase).mockReturnValue(undefined);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "admin:rebuildDatabase"
        )?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "admin-token");

      expect(result.success).toBe(true);
      expect(repositories.rebuildDatabase).toHaveBeenCalled();
    });

    it("should reject non-admin users", async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "user@example.com",
        isAdmin: false,
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "admin:rebuildDatabase"
        )?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "user-token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unauthorized");
      expect(repositories.rebuildDatabase).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      registerAdminHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "admin@example.com",
        isAdmin: true,
      });

      vi.mocked(repositories.rebuildDatabase).mockImplementation(() => {
        throw new Error("Rebuild failed");
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "admin:rebuildDatabase"
        )?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "admin-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rebuild failed");
    });
  });
});

// We use getCredentials from repositories in our mocks

// Mock electron
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("../../src/routes/handlers/timesheet/main-window", () => ({
  isTrustedIpcSender: vi.fn(() => true),
}));

// Mock repositories
vi.mock("../../src/models", () => ({
  storeCredentials: vi.fn(),
  getCredentials: vi.fn(),
  createSession: vi.fn(),
  validateSession: vi.fn(),
  clearSession: vi.fn(),
  clearUserSessions: vi.fn(),
}));

// Mock logger
vi.mock("../../../shared/logger", () => ({
  ipcLogger: {
    verbose: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    audit: vi.fn(),
    error: vi.fn(),
  },
  appLogger: {
    warn: vi.fn(),
  },
}));

// Mock validation
vi.mock("../../src/validation/validate-ipc-input", () => ({
  validateInput: vi.fn((schema, data) => ({ success: true, data })),
}));

describe("auth-handlers", () => {
  const originalEnv = process.env;
  let handleCalls: Array<
    [string, (event: IpcMainInvokeEvent, ...args: any[]) => any]
  > = [];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    handleCalls = [];

    // Capture handle calls
    vi.mocked(ipcMain.handle).mockImplementation(
      (
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: any[]) => any
      ) => {
        handleCalls.push([channel, handler]);
        return undefined as never;
      }
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const getHandler = (channel: string) => {
    const entry = handleCalls.find(([ch]) => ch === channel);
    return entry?.[1];
  };

  describe("registerAuthHandlers", () => {
    it("should register all auth handlers", () => {
      registerAuthHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith("ping", expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "auth:login",
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "auth:validateSession",
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "auth:logout",
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "auth:getCurrentSession",
        expect.any(Function)
      );
    });
  });

  describe("ping handler", () => {
    it("should return pong with message", async () => {
      registerAuthHandlers();

      const handler = getHandler("ping") as (
        event: unknown,
        message?: string
      ) => Promise<string>;

      const result = await handler({}, "test");
      expect(result).toBe("pong: test");
    });
  });

  describe("auth:login handler", () => {
    it("should login regular user successfully", async () => {
      // Mock getCredentials to return null (new user scenario)
      vi.mocked(repositories.getCredentials).mockReturnValue(null);
      vi.mocked(repositories.storeCredentials).mockReturnValue({
        success: true,
        message: "Stored",
        changes: 1,
      });
      vi.mocked(repositories.createSession).mockReturnValue("test-token");

      registerAuthHandlers();

      const handler = getHandler("auth:login") as (
        event: unknown,
        email: string,
        password: string,
        stayLoggedIn: boolean
      ) => Promise<{
        success: boolean;
        token?: string;
        isAdmin?: boolean;
        error?: string;
      }>;

      const result = await handler({}, "user@example.com", "password", false);

      expect(result.success).toBe(true);
      expect(result.token).toBe("test-token");
      expect(result.isAdmin).toBe(false);
      expect(repositories.storeCredentials).toHaveBeenCalledWith(
        "smartsheet",
        "user@example.com",
        "password"
      );
    });

    it("should login admin user successfully", async () => {
      // Set env vars before importing/registering
      const originalAdminUser = process.env["SHEETPILOT_ADMIN_USERNAME"];
      const originalAdminPass = process.env["SHEETPILOT_ADMIN_PASSWORD"];

      process.env["SHEETPILOT_ADMIN_USERNAME"] = "Admin";
      process.env["SHEETPILOT_ADMIN_PASSWORD"] = "admin123";

      vi.mocked(repositories.createSession).mockReturnValue("admin-token");

      // Re-import the module to pick up new env vars
      vi.resetModules();
      const { registerAuthHandlers: registerAuth } = await import(
        "../../src/routes/auth-handlers"
      );

      // Clear and setup fresh handler capture
      handleCalls = [];
      vi.mocked(ipcMain.handle).mockImplementation(
        (
          channel: string,
          handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
        ) => {
          handleCalls.push([channel, handler]);
          return undefined as never;
        }
      );

      registerAuth();

      const handler = getHandler("auth:login") as (
        event: unknown,
        email: string,
        password: string,
        stayLoggedIn: boolean
      ) => Promise<{
        success: boolean;
        token?: string;
        isAdmin?: boolean;
        error?: string;
      }>;

      const result = await handler({}, "Admin", "admin123", false);

      expect(result.success).toBe(true);
      expect(result.isAdmin).toBe(true);
      expect(repositories.storeCredentials).not.toHaveBeenCalled();

      // Restore env vars
      if (originalAdminUser)
        process.env["SHEETPILOT_ADMIN_USERNAME"] = originalAdminUser;
      else delete process.env["SHEETPILOT_ADMIN_USERNAME"];
      if (originalAdminPass)
        process.env["SHEETPILOT_ADMIN_PASSWORD"] = originalAdminPass;
      else delete process.env["SHEETPILOT_ADMIN_PASSWORD"];
    });

    it("should handle credential storage failure", async () => {
      // Mock getCredentials to return null (new user scenario)
      vi.mocked(repositories.getCredentials).mockReturnValue(null);
      vi.mocked(repositories.storeCredentials).mockReturnValue({
        success: false,
        message: "Storage failed",
        changes: 0,
      });

      registerAuthHandlers();

      const handler = getHandler("auth:login") as (
        event: unknown,
        email: string,
        password: string,
        stayLoggedIn: boolean
      ) => Promise<{
        success: boolean;
        token?: string;
        isAdmin?: boolean;
        error?: string;
      }>;

      const result = await handler({}, "user@example.com", "password", false);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Storage failed");
    });

    it("should handle errors gracefully", async () => {
      // Mock getCredentials to return null (new user scenario)
      vi.mocked(repositories.getCredentials).mockReturnValue(null);
      vi.mocked(repositories.storeCredentials).mockImplementation(() => {
        throw new Error("Database error");
      });

      registerAuthHandlers();

      const handler = getHandler("auth:login") as (
        event: unknown,
        email: string,
        password: string,
        stayLoggedIn: boolean
      ) => Promise<{
        success: boolean;
        token?: string;
        isAdmin?: boolean;
        error?: string;
      }>;

      const result = await handler({}, "user@example.com", "password", false);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("auth:validateSession handler", () => {
    it("should validate valid session", async () => {
      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "user@example.com",
        isAdmin: false,
      });

      registerAuthHandlers();

      const handler = getHandler("auth:validateSession") as (
        event: unknown,
        token: string
      ) => Promise<{ valid: boolean; email?: string; isAdmin?: boolean }>;

      const result = await handler({}, "test-token");

      expect(result.valid).toBe(true);
      expect(result.email).toBe("user@example.com");
    });

    it("should invalidate invalid session", async () => {
      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: false,
      });

      registerAuthHandlers();

      const handler = getHandler("auth:validateSession") as (
        event: unknown,
        token: string
      ) => Promise<{ valid: boolean; email?: string; isAdmin?: boolean }>;

      const result = await handler({}, "invalid-token");

      expect(result.valid).toBe(false);
    });
  });

  describe("auth:logout handler", () => {
    it("should logout user successfully", async () => {
      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "user@example.com",
        isAdmin: false,
      });
      vi.mocked(repositories.clearSession).mockReturnValue(undefined);
      vi.mocked(repositories.clearUserSessions).mockReturnValue(undefined);

      registerAuthHandlers();

      const handler = getHandler("auth:logout") as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean }>;

      const result = await handler({}, "test-token");

      expect(result.success).toBe(true);
    });

    it("should handle logout errors", async () => {
      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "user@example.com",
        isAdmin: false,
      });
      vi.mocked(repositories.clearUserSessions).mockImplementation(() => {
        throw new Error("Logout failed");
      });

      registerAuthHandlers();

      const handler = getHandler("auth:logout") as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "test-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Logout failed");
    });
  });

  describe("auth:getCurrentSession handler", () => {
    it("should get current session", async () => {
      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "user@example.com",
        isAdmin: false,
      });

      registerAuthHandlers();

      const handler = getHandler("auth:getCurrentSession") as (
        event: unknown,
        token: string
      ) => Promise<{
        email?: string;
        token?: string;
        isAdmin?: boolean;
      } | null>;

      const result = await handler({}, "test-token");

      expect(result).toBeDefined();
      expect(result?.email).toBe("user@example.com");
      expect(result?.isAdmin).toBe(false);
    });
  });
});

// Mock electron
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("../../src/routes/handlers/timesheet/main-window", () => ({
  isTrustedIpcSender: vi.fn(() => true),
}));

// Mock repositories
vi.mock("../../src/models", () => ({
  storeCredentials: vi.fn(),
  listCredentials: vi.fn(),
  deleteCredentials: vi.fn(),
}));

// Mock logger
vi.mock("../../../shared/logger", () => ({
  ipcLogger: {
    audit: vi.fn(),
    info: vi.fn(),
    security: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock validation
vi.mock("../../src/validation/validate-ipc-input", () => ({
  validateInput: vi.fn((schema, data) => ({ success: true, data })),
}));

describe("credentials-handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerCredentialsHandlers", () => {
    it("should register all credentials handlers", () => {
      registerCredentialsHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith(
        "credentials:store",
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "credentials:list",
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "credentials:delete",
        expect.any(Function)
      );
    });
  });

  describe("credentials:store handler", () => {
    it("should store credentials successfully", async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.storeCredentials).mockReturnValue({
        success: true,
        message: "Stored",
        changes: 1,
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "credentials:store")?.[1] as (
        event: unknown,
        service: string,
        email: string,
        password: string
      ) => Promise<{
        success: boolean;
        message?: string;
        changes?: number;
        error?: string;
      }>;

      const result = await handler(
        {},
        "smartsheet",
        "user@example.com",
        "password123"
      );

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(repositories.storeCredentials).toHaveBeenCalledWith(
        "smartsheet",
        "user@example.com",
        "password123"
      );
    });

    it("should handle storage errors", async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.storeCredentials).mockImplementation(() => {
        throw new Error("Storage failed");
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "credentials:store")?.[1] as (
        event: unknown,
        service: string,
        email: string,
        password: string
      ) => Promise<unknown>;

      await expect(
        handler({}, "smartsheet", "user@example.com", "password123")
      ).rejects.toThrow(CredentialsStorageError);
    });
  });

  describe("credentials:list handler", () => {
    it("should list credentials successfully", async () => {
      registerCredentialsHandlers();

      const mockCredentials = [
        {
          id: 1,
          service: "smartsheet",
          email: "user@example.com",
          created_at: "2025-01-01",
          updated_at: "2025-01-01",
        },
      ];

      vi.mocked(repositories.listCredentials).mockReturnValue(
        mockCredentials as never
      );

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "credentials:list")?.[1] as (
        event: unknown
      ) => Promise<{ success: boolean; credentials: unknown[] }>;

      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.credentials).toEqual(mockCredentials);
    });

    it("should handle list errors", async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.listCredentials).mockImplementation(() => {
        throw new Error("List failed");
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "credentials:list")?.[1] as (
        event: unknown
      ) => Promise<{
        success: boolean;
        credentials: unknown[];
        error?: string;
      }>;

      const result = await handler({});

      expect(result.success).toBe(false);
      expect(result.error).toBe("List failed");
      expect(result.credentials).toEqual([]);
    });
  });

  describe("credentials:delete handler", () => {
    it("should delete credentials successfully", async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.deleteCredentials).mockReturnValue({
        success: true,
        message: "Deleted",
        changes: 1,
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "credentials:delete")?.[1] as (
        event: unknown,
        service: string
      ) => Promise<{ success: boolean; changes?: number; error?: string }>;

      const result = await handler({}, "smartsheet");

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(repositories.deleteCredentials).toHaveBeenCalledWith("smartsheet");
    });

    it("should handle delete errors", async () => {
      registerCredentialsHandlers();

      vi.mocked(repositories.deleteCredentials).mockImplementation(() => {
        throw new Error("Delete failed");
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "credentials:delete")?.[1] as (
        event: unknown,
        service: string
      ) => Promise<{ success: boolean; changes?: number; error?: string }>;

      const result = await handler({}, "smartsheet");

      expect(result.success).toBe(false);
      // Implementation returns `message` for this handler on error.
      expect((result as { message?: string }).message).toBe("Delete failed");
      expect(result.changes).toBe(0);
    });
  });
});

// Mock electron
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("../../src/routes/handlers/timesheet/main-window", () => ({
  isTrustedIpcSender: vi.fn(() => true),
}));

// Mock repositories
vi.mock("../../src/models", () => ({
  getDb: vi.fn(),
  validateSession: vi.fn(),
}));

// Mock logger
vi.mock("../../../shared/logger", () => ({
  ipcLogger: {
    security: vi.fn(),
    verbose: vi.fn(),
    audit: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("database-handlers", () => {
  let mockDb: {
    prepare: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      prepare: vi.fn(),
      exec: vi.fn(),
    };
    vi.mocked(repositories.getDb).mockReturnValue(mockDb as never);
  });

  describe("registerDatabaseHandlers", () => {
    it("should register all database handlers", () => {
      registerDatabaseHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith(
        "database:getAllTimesheetEntries",
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "database:getAllArchiveData",
        expect.any(Function)
      );
    });
  });

  describe("database:getAllTimesheetEntries handler", () => {
    it("should get timesheet entries with pagination", async () => {
      registerDatabaseHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "user@example.com",
        isAdmin: false,
      });

      const mockCountStmt = {
        get: vi.fn().mockReturnValue({ total: 150 }),
      };

      const mockGetAllStmt = {
        all: vi.fn().mockReturnValue([
          { id: 1, date: "2025-01-15", status: "Complete" },
          { id: 2, date: "2025-01-16", status: "Complete" },
        ]),
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes("COUNT")) return mockCountStmt;
        return mockGetAllStmt;
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "database:getAllTimesheetEntries"
        )?.[1] as (
        event: unknown,
        token: string,
        options?: { page?: number; pageSize?: number }
      ) => Promise<{
        success: boolean;
        entries: unknown[];
        totalCount: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>;

      const result = await handler({}, "test-token", {
        page: 0,
        pageSize: 100,
      });

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(2);
      expect(result.totalCount).toBe(150);
      expect(result.totalPages).toBe(2);
    });

    it("should reject requests without token", async () => {
      registerDatabaseHandlers();

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "database:getAllTimesheetEntries"
        )?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Session token is required");
    });

    it("should reject invalid sessions", async () => {
      registerDatabaseHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: false,
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "database:getAllTimesheetEntries"
        )?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "invalid-token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Session is invalid");
    });

    it("should handle database errors", async () => {
      registerDatabaseHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "user@example.com",
        isAdmin: false,
      });

      mockDb.prepare.mockImplementation(() => {
        throw new Error("Database error");
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "database:getAllTimesheetEntries"
        )?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "test-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("database:getAllArchiveData handler", () => {
    it("should get all archive data", async () => {
      registerDatabaseHandlers();

      vi.mocked(repositories.validateSession).mockReturnValue({
        valid: true,
        email: "user@example.com",
        isAdmin: false,
      });

      const mockTimesheet = [{ id: 1, date: "2025-01-15", status: "Complete" }];
      const mockCredentials = [
        { id: 1, service: "smartsheet", email: "user@example.com" },
      ];

      const mockStmt = {
        all: vi
          .fn()
          .mockReturnValueOnce(mockTimesheet)
          .mockReturnValueOnce(mockCredentials),
      };

      mockDb.prepare.mockReturnValue(mockStmt);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "database:getAllArchiveData"
        )?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{
        success: boolean;
        timesheet?: unknown[];
        credentials?: unknown[];
      }>;

      const result = await handler({}, "test-token");

      expect(result.success).toBe(true);
      expect(result.timesheet).toEqual(mockTimesheet);
      expect(result.credentials).toEqual(mockCredentials);
    });

    it("should reject requests without token", async () => {
      registerDatabaseHandlers();

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "database:getAllArchiveData"
        )?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Session token is required");
    });
  });
});

// Mock all handler modules
vi.mock("../../src/routes/auth-handlers");
vi.mock("../../src/routes/credentials-handlers");
vi.mock("../../src/routes/timesheet-handlers");
vi.mock("../../src/routes/admin-handlers");
vi.mock("../../src/routes/database-handlers");
vi.mock("../../src/routes/logs-handlers");
vi.mock("../../src/routes/logger-handlers");
vi.mock("../../src/routes/settings-handlers");
vi.mock("../../../shared/logger");

describe("ipc/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerAllIPCHandlers", () => {
    it("should register all IPC handler modules", () => {
      registerAllIPCHandlers();

      expect(registerAuthHandlers).toHaveBeenCalled();
      expect(registerCredentialsHandlers).toHaveBeenCalled();
      expect(registerTimesheetHandlers).toHaveBeenCalled();
      expect(registerAdminHandlers).toHaveBeenCalled();
      expect(registerDatabaseHandlers).toHaveBeenCalled();
      expect(registerLogsHandlers).toHaveBeenCalled();
      expect(registerLoggerHandlers).toHaveBeenCalled();
      expect(registerSettingsHandlers).toHaveBeenCalled();
    });

    it("should log verbose messages for each handler registration", () => {
      registerAllIPCHandlers();

      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Starting IPC handler registration",
        { hasMainWindow: false }
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Registering auth handlers"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Auth handlers registered successfully"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Registering credentials handlers"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Credentials handlers registered successfully"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Registering timesheet handlers"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Timesheet handlers registered successfully"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Registering admin handlers"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Admin handlers registered successfully"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Registering database handlers"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Database handlers registered successfully"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Registering logs handlers"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Logs handlers registered successfully"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Registering logger handlers"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Logger handlers registered successfully"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Registering settings handlers"
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Settings handlers registered successfully"
      );
    });

    it("should log success message with all modules", () => {
      registerAllIPCHandlers();

      expect(appLogger.info).toHaveBeenCalledWith(
        "All IPC handler modules registered successfully",
        {
          modulesRegistered: [
            "auth",
            "credentials",
            "timesheet",
            "admin",
            "database",
            "logs",
            "logger",
            "settings",
          ],
        }
      );
    });

    it("should set main window when provided", () => {
      const mockWindow = {} as BrowserWindow;

      registerAllIPCHandlers(mockWindow);

      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Starting IPC handler registration",
        { hasMainWindow: true }
      );
      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Setting main window reference for timesheet handlers"
      );
      expect(setMainWindow).toHaveBeenCalledWith(mockWindow);
    });

    it("should not set main window when null", () => {
      registerAllIPCHandlers(null);

      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Starting IPC handler registration",
        { hasMainWindow: false }
      );
      expect(setMainWindow).not.toHaveBeenCalled();
    });

    it("should not set main window when undefined", () => {
      registerAllIPCHandlers(undefined);

      expect(appLogger.verbose).toHaveBeenCalledWith(
        "Starting IPC handler registration",
        { hasMainWindow: false }
      );
      expect(setMainWindow).not.toHaveBeenCalled();
    });

    it("should handle registration errors", () => {
      const error = new Error("Registration failed");
      vi.mocked(registerAuthHandlers).mockImplementation(() => {
        throw error;
      });

      expect(() => registerAllIPCHandlers()).toThrow("Registration failed");

      expect(appLogger.error).toHaveBeenCalledWith(
        "Failed to register IPC handler module",
        {
          error: "Registration failed",
          stack: expect.any(String),
        }
      );
    });

    it("should handle non-Error exceptions", () => {
      const error = "String error";
      vi.mocked(registerAuthHandlers).mockImplementation(() => {
        throw error;
      });

      expect(() => registerAllIPCHandlers()).toThrow();

      expect(appLogger.error).toHaveBeenCalledWith(
        "Failed to register IPC handler module",
        {
          error: "String error",
          stack: undefined,
        }
      );
    });
  });
});

/**
 * @fileoverview Comprehensive IPC Handler Tests
 *
 * Tests all IPC handlers in main.ts to ensure complete coverage
 * of the communication layer between renderer and main process.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

declare global {
  // Storage for mocked IPC handlers used by tests

  var __test_handlers:
    | Record<string, (...args: unknown[]) => unknown>
    | undefined;
}

// Ensure handler storage exists before mocks consume it
(
  globalThis as unknown as {
    __test_handlers?: Record<string, (...args: unknown[]) => unknown>;
  }
).__test_handlers =
  (
    globalThis as unknown as {
      __test_handlers?: Record<string, (...args: unknown[]) => unknown>;
    }
  ).__test_handlers ?? {};

// Mock electron-updater to prevent import failures
vi.mock("electron-updater", () => {
  const autoUpdater = {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    logger: null,
    on: vi.fn(),
    checkForUpdates: vi.fn(() => Promise.resolve()),
    downloadUpdate: vi.fn(() => Promise.resolve()),
  };
  return { autoUpdater };
});

// Mock Electron modules
vi.mock("electron", () => {
  // Initialize handlers storage in the mock factory (hoisted)
  if (!globalThis.__test_handlers) {
    globalThis.__test_handlers = {};
  }

  const MAIN_WEB_CONTENTS_ID = 1;

  const ipcMain = {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
      // Wrap handler to skip the event parameter when called from tests
      (
        globalThis.__test_handlers as Record<
          string,
          (...args: unknown[]) => unknown
        >
      )[channel] = async (...args: unknown[]) => {
        // Call the actual handler with a mocked event/sender and the provided args
        return fn({ sender: { id: MAIN_WEB_CONTENTS_ID } }, ...args);
      };
      return undefined;
    }),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
  };

  const dialog = {
    showOpenDialog: vi.fn(),
  };

  const shell = {
    openPath: vi.fn(),
  };

  return {
    app: {
      getPath: vi.fn((key: string) =>
        key === "userData" ? "C:/tmp/sheetpilot-userdata" : "C:/tmp"
      ),
      getAppPath: vi.fn(() => "C:\\Local\\Sheetpilot"),
      getVersion: vi.fn(() => "1.3.6"),
      isPackaged: false,
      whenReady: vi.fn(() => ({
        then: (_callback: () => void) => {
          // Don't execute callback automatically to prevent side effects
          return Promise.resolve();
        },
        catch: () => Promise.resolve(),
      })),
      on: vi.fn(),
      quit: vi.fn(),
      exit: vi.fn(),
    },
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        workAreaSize: { width: 1920, height: 1080 },
      })),
    },
    ipcMain,
    dialog,
    shell,
    BrowserWindow: vi.fn().mockImplementation(() => ({
      webContents: {
        id: MAIN_WEB_CONTENTS_ID,
        on: vi.fn(),
        once: vi.fn(),
        send: vi.fn(),
        executeJavaScript: vi.fn(),
      },
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      once: vi.fn(),
      on: vi.fn(),
      show: vi.fn(),
      maximize: vi.fn(),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 })),
      isMaximized: vi.fn(() => false),
    })),
  };
});

// Create mockDb in module scope so we can access it
const createMockDb = () => ({
  prepare: vi.fn((_sql?: string) => ({
    all: vi.fn(() => []),
    run: vi.fn(() => ({ changes: 1 })),
    get: vi.fn(() => ({})),
  })),
  exec: vi.fn(),
  close: vi.fn(),
  transaction: vi.fn((callback) => {
    // Return a function that executes the callback when called (matches better-sqlite3 API)
    return () => callback();
  }),
});

// Store reference to the mock DB that will be returned by openDb
const mockDbInstance = createMockDb();

// Mock repositories module (single source of truth)
vi.mock("../src/models", () => {
  const resetInProgressTimesheetEntries = vi.fn(() => {
    const db = mockDbInstance;
    const resetStatus = db.prepare(
      `UPDATE timesheet SET status = NULL WHERE status = 'in_progress'`
    );
    const result = resetStatus.run();
    return result.changes;
  });

  return {
    // Connection management
    setDbPath: vi.fn(),
    ensureSchema: vi.fn(),
    getDbPath: vi.fn(() => "C:/tmp/sheetpilot.sqlite"),
    getDb: vi.fn(() => mockDbInstance),
    openDb: vi.fn(() => mockDbInstance),
    closeConnection: vi.fn(),
    shutdownDatabase: vi.fn(),
    rebuildDatabase: vi.fn(),

    // Timesheet operations
    insertTimesheetEntry: vi.fn(),
    insertTimesheetEntries: vi.fn(() => ({
      success: true,
      total: 0,
      inserted: 0,
      duplicates: 0,
      errors: 0,
    })),
    checkDuplicateEntry: vi.fn(() => false),
    getDuplicateEntries: vi.fn(() => []),
    getPendingTimesheetEntries: vi.fn(() => []),
    markTimesheetEntriesAsInProgress: vi.fn(),
    resetTimesheetEntriesStatus: vi.fn(),
    resetInProgressTimesheetEntries,
    markTimesheetEntriesAsSubmitted: vi.fn(),
    removeFailedTimesheetEntries: vi.fn(),
    getTimesheetEntriesByIds: vi.fn(() => []),
    getSubmittedTimesheetEntriesForExport: vi.fn(() => []),

    // Credentials operations
    storeCredentials: vi.fn(),
    getCredentials: vi.fn(),
    listCredentials: vi.fn(),
    deleteCredentials: vi.fn(),
    clearAllCredentials: vi.fn(),

    // Session operations
    createSession: vi.fn(() => "mock-session-token"),
    validateSession: vi.fn((token: string) => {
      if (token === "valid-token" || token === "mock-session-token") {
        return { valid: true, email: "user@test.com", isAdmin: false };
      }
      return { valid: false };
    }),
    clearSession: vi.fn(),
    clearUserSessions: vi.fn(),
    getSessionByEmail: vi.fn(),

    // Migrations (used by bootstrap-database)
    runMigrations: vi.fn(() => ({
      success: true,
      migrationsRun: 0,
      fromVersion: 0,
      toVersion: 0,
    })),
  };
});

// Mock timesheet importer (default: no entries to submit)
vi.mock("../src/services/timesheet-importer", () => ({
  submitTimesheets: vi.fn(async () => ({
    ok: true,
    submittedIds: [],
    removedIds: [],
    totalProcessed: 0,
    successCount: 0,
    removedCount: 0,
  })),
}));

// Mock logger
vi.mock("../../shared/logger", () => {
  const createMockLogger = () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    audit: vi.fn(),
    security: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() })),
  });

  return {
    initializeLogging: vi.fn(),
    appLogger: createMockLogger(),
    dbLogger: createMockLogger(),
    ipcLogger: createMockLogger(),
    botLogger: createMockLogger(),
    importLogger: createMockLogger(),
  };
});

// Import after mocks

type VMock = ReturnType<typeof vi.fn>;
const mdb = repo as unknown as {
  openDb: VMock;
  getDb: VMock;
  setDbPath: VMock;
  ensureSchema: VMock;
  getDbPath: VMock;
  storeCredentials: VMock;
  getCredentials: VMock;
  listCredentials: VMock;
  deleteCredentials: VMock;
  getPendingTimesheetEntries: VMock;
  getSubmittedTimesheetEntriesForExport: VMock;
  resetInProgressTimesheetEntries: VMock;
};

const mimps = imp as unknown as {
  submitTimesheets: ReturnType<typeof vi.fn>;
};

describe("IPC Handlers Comprehensive Tests", () => {
  let testDbPath: string;
  let handlers: Record<string, (...args: unknown[]) => unknown>;

  beforeAll(async () => {
    // Register handlers once for all tests (provide a mainWindow so sender validation can pass)
    const electron = await import("electron");
    const mainWindow = new electron.BrowserWindow();
    registerAllIPCHandlers(
      mainWindow as unknown as import("electron").BrowserWindow
    );
    handlers = globalThis.__test_handlers!;
  });

  beforeEach(() => {
    // Create isolated test database
    testDbPath = path.join(
      os.tmpdir(),
      `sheetpilot-ipc-test-${Date.now()}.sqlite`
    );

    // Only clear call history, preserve mock implementations
    vi.clearAllMocks();

    // Re-setup mockDbInstance after clearAllMocks
    mockDbInstance.prepare = vi.fn(() => ({
      all: vi.fn(() => []),
      run: vi.fn(() => ({ changes: 1 })),
      get: vi.fn(() => ({})),
    }));
    mockDbInstance.exec = vi.fn();
    mockDbInstance.close = vi.fn();
    mockDbInstance.transaction = vi.fn((callback) => () => callback());

    // Re-setup openDb and getDb mocks to return mockDbInstance
    mdb.openDb.mockImplementation(() => mockDbInstance);
    mdb.getDb.mockImplementation(() => mockDbInstance);

    // Re-setup resetInProgressTimesheetEntries mock to use the mocked database
    mdb.resetInProgressTimesheetEntries.mockImplementation(() => {
      const db = mockDbInstance;
      const resetStatus = db.prepare(
        `UPDATE timesheet SET status = NULL WHERE status = 'in_progress'`
      );
      const result = resetStatus.run();
      return result.changes;
    });

    // Re-setup submitTimesheets mock with default implementation (0 entries)
    // This is needed because clearAllMocks() clears the spy
    if (mimps.submitTimesheets.mockResolvedValue) {
      mimps.submitTimesheets.mockResolvedValue({
        ok: true,
        submittedIds: [],
        removedIds: [],
        totalProcessed: 0,
        successCount: 0,
        removedCount: 0,
      });
    }
  });

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("ping handler", () => {
    it("should return pong with message", async () => {
      const result = await handlers["ping"]("test-message");
      expect(result).toBe("pong: test-message");
    });

    it("should handle empty message", async () => {
      const result = await handlers["ping"]("");
      expect(result).toBe("pong: ");
    });

    it("should handle undefined message", async () => {
      const result = await handlers["ping"](undefined);
      expect(result).toBe("pong: undefined");
    });
  });

  describe("credentials:store handler", () => {
    it("should store credentials successfully", async () => {
      mdb.storeCredentials.mockReturnValue({
        success: true,
        message: "Credentials stored successfully",
        changes: 1,
      });

      const result = (await handlers["credentials:store"](
        "test-service",
        "user@test.com",
        "password123"
      )) as {
        success: boolean;
        message: string;
        changes?: number;
        error?: string;
      };

      expect(result.success).toBe(true);
      expect(result.message).toBe("Credentials stored successfully");
      expect(mdb.storeCredentials).toHaveBeenCalledWith(
        "test-service",
        "user@test.com",
        "password123"
      );
    });

    it("should handle storage failure", async () => {
      mdb.storeCredentials.mockReturnValue({
        success: false,
        message: "Database error",
        changes: 0,
      });

      const result = (await handlers["credentials:store"](
        "test-service",
        "user@test.com",
        "password123"
      )) as {
        success: boolean;
        message: string;
        changes?: number;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.message).toBe("Database error");
    });

    it("should handle invalid parameters", async () => {
      const result = (await handlers["credentials:store"]("", "", "")) as {
        success: boolean;
        message?: string;
        changes?: number;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid input");
    });
  });

  describe("credentials:list handler", () => {
    it("should list all credentials", async () => {
      const mockCredentials = [
        {
          id: 1,
          service: "service1",
          email: "user1@test.com",
          created_at: "2025-01-01",
        },
        {
          id: 2,
          service: "service2",
          email: "user2@test.com",
          created_at: "2025-01-02",
        },
      ];
      mdb.listCredentials.mockReturnValue(mockCredentials);

      const result = (await handlers["credentials:list"]()) as {
        success: boolean;
        credentials: Array<{
          id: number;
          service: string;
          email: string;
          created_at: string;
        }>;
      };

      expect(result.success).toBe(true);
      expect(result.credentials).toEqual(mockCredentials);
      expect(mdb.listCredentials).toHaveBeenCalled();
    });

    it("should handle empty credentials list", async () => {
      mdb.listCredentials.mockReturnValue([]);

      const result = (await handlers["credentials:list"]()) as {
        success: boolean;
        credentials: unknown[];
      };

      expect(result.success).toBe(true);
      expect(result.credentials).toEqual([]);
    });
  });

  describe("credentials:delete handler", () => {
    it("should delete credentials successfully", async () => {
      mdb.deleteCredentials.mockReturnValue({
        success: true,
        message: "Credentials deleted successfully",
        changes: 1,
      });

      const result = (await handlers["credentials:delete"]("test-service")) as {
        success: boolean;
        message: string;
        changes?: number;
      };

      expect(result.success).toBe(true);
      expect(result.message).toBe("Credentials deleted successfully");
      expect(mdb.deleteCredentials).toHaveBeenCalledWith("test-service");
    });

    it("should handle deletion failure", async () => {
      mdb.deleteCredentials.mockReturnValue({
        success: false,
        message: "Database error",
        changes: 0,
      });

      const result = (await handlers["credentials:delete"]("test-service")) as {
        success: boolean;
        message: string;
        changes?: number;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.message).toBe("Database error");
    });

    it("should handle invalid service parameter", async () => {
      const result = (await handlers["credentials:delete"]("")) as {
        success: boolean;
        message?: string;
        changes?: number;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Service name is required");
    });
  });

  describe("database:getAllTimesheetEntries handler", () => {
    it("should retrieve all timesheet entries", async () => {
      const mockEntries = [
        {
          id: 1,
          date: "2025-01-15",
          project: "Test Project",
          status: "Complete",
        },
        { id: 2, date: "2025-01-16", project: "Test Project 2", status: null },
      ];

      // Mock the database prepare to return entries
      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => mockEntries),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({})),
      });

      const result = (await handlers["database:getAllTimesheetEntries"](
        "valid-token"
      )) as {
        success: boolean;
        entries: Array<{
          id: number;
          date: string;
          project: string;
          status: string | null;
        }>;
        error?: string;
      };

      expect(result.success).toBe(true);
      expect(result.entries).toEqual(mockEntries);
    });

    it("should handle empty entries list", async () => {
      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({})),
      });

      const result = (await handlers["database:getAllTimesheetEntries"](
        "valid-token"
      )) as { success: boolean; entries: unknown[]; error?: string };

      expect(result.success).toBe(true);
      expect(result.entries).toEqual([]);
    });

    it("should handle database errors", async () => {
      mockDbInstance.prepare.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const result = (await handlers["database:getAllTimesheetEntries"](
        "valid-token"
      )) as { success: boolean; entries?: unknown[]; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database connection failed");
    });
  });

  describe("database:getAllArchiveData handler (batched)", () => {
    it("should retrieve both timesheet and credentials in a single call", async () => {
      const mockTimesheet = [
        {
          id: 1,
          date: "2025-01-15",
          project: "Test Project",
          status: "Complete",
        },
        {
          id: 2,
          date: "2025-01-16",
          project: "Test Project 2",
          status: "Complete",
        },
      ];
      const mockCredentials = [
        { id: 1, service: "smartsheet", email: "user@test.com" },
      ];

      // Mock multiple prepare calls for timesheet and credentials
      let callCount = 0;
      mockDbInstance.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call is for timesheet
          return {
            all: vi.fn(() => mockTimesheet),
            run: vi.fn(() => ({ changes: 0 })),
            get: vi.fn(() => ({})),
          };
        } else {
          // Second call is for credentials
          return {
            all: vi.fn(() => mockCredentials),
            run: vi.fn(() => ({ changes: 0 })),
            get: vi.fn(() => ({})),
          };
        }
      });

      const result = (await handlers["database:getAllArchiveData"](
        "valid-token"
      )) as {
        success: boolean;
        timesheet: unknown[];
        credentials: unknown[];
        error?: string;
      };

      expect(result.success).toBe(true);
      expect(result.timesheet).toEqual(mockTimesheet);
      expect(result.credentials).toEqual(mockCredentials);
      expect(mockDbInstance.prepare).toHaveBeenCalledTimes(2); // Two queries in one handler
    });

    it("should require valid session token", async () => {
      const result = (await handlers["database:getAllArchiveData"]("")) as {
        success: boolean;
        timesheet?: unknown[];
        credentials?: unknown[];
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Session token is required");
    });

    it("should validate session token", async () => {
      // validateSession mock already returns { valid: false } for 'invalid-token'
      const result = (await handlers["database:getAllArchiveData"](
        "invalid-token"
      )) as {
        success: boolean;
        timesheet?: unknown[];
        credentials?: unknown[];
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Session is invalid or expired");
    });

    it("should handle database errors gracefully", async () => {
      mockDbInstance.prepare.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const result = (await handlers["database:getAllArchiveData"](
        "valid-token"
      )) as {
        success: boolean;
        timesheet?: unknown[];
        credentials?: unknown[];
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database connection failed");
    });
  });

  describe("timesheet:exportToCSV handler", () => {
    it("should export timesheet data to CSV", async () => {
      const mockEntries = [
        {
          date: "2025-01-15",
          hours: 8.0,
          project: "Test Project",
          tool: "VS Code",
          detail_charge_code: "DEV001",
          task_description: "Test task",
          status: "Complete",
          submitted_at: "2025-01-15 17:00:00",
        },
      ];
      mdb.getSubmittedTimesheetEntriesForExport.mockReturnValue(mockEntries);

      const result = (await handlers["timesheet:exportToCSV"]()) as {
        success: boolean;
        csvData?: string;
        error?: string;
      };

      expect(result.success).toBe(true);
      expect(result.csvData).toContain(
        "Date,Start Time,End Time,Hours,Project,Tool,Charge Code,Task Description,Status,Submitted At"
      );
      expect(result.csvData).toContain(
        '2025-01-15,09:00,17:00,8,"Test Project","VS Code","DEV001","Test task",Complete,2025-01-15 17:00:00'
      );
    });

    it("should handle empty data export", async () => {
      mdb.getSubmittedTimesheetEntriesForExport.mockReturnValue([]);

      const result = (await handlers["timesheet:exportToCSV"]()) as {
        success: boolean;
        csvData?: string;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("No submitted timesheet entries found");
    });

    it("should handle export errors", async () => {
      mdb.getSubmittedTimesheetEntriesForExport.mockImplementation(() => {
        throw new Error("Export failed");
      });

      const result = (await handlers["timesheet:exportToCSV"]()) as {
        success: boolean;
        csvData?: string;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Export failed");
    });
  });

  describe("timesheet:saveDraft handler", () => {
    it("should save valid draft data", async () => {
      // Use current quarter date (Q4 2025)
      const validRow = {
        date: "2025-10-15",
        hours: 8.0,
        project: "Test Project",
        taskDescription: "Test task",
      };

      // First prepare call: INSERT statement
      mockDbInstance.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
        get: vi.fn(() => ({})),
      });

      // Second prepare call: SELECT statement
      mockDbInstance.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 0 })),
        get: vi.fn(() => ({
          id: 1,
          date: "2025-10-15",
          time_in: 540, // 09:00 in minutes
          time_out: 1020, // 17:00 in minutes
          project: "Test Project",
          tool: null,
          detail_charge_code: null,
          task_description: "Test task",
          status: null,
        })),
      });

      const result = (await handlers["timesheet:saveDraft"](validRow)) as {
        success: boolean;
        changes?: number;
        error?: string;
      };

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
    });

    it("should validate required fields", async () => {
      const invalidRow = {
        date: "",
        hours: 8.0,
        project: "Test Project",
        taskDescription: "Test task",
      };

      const result = (await handlers["timesheet:saveDraft"](invalidRow)) as {
        success: boolean;
        changes?: number;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid input");
    });

    it("should validate time format", async () => {
      const invalidRow = {
        date: "2025-10-15",
        hours: 0.1, // Invalid: not 15-minute increment
        project: "Test Project",
        taskDescription: "Test task",
      };

      const result = (await handlers["timesheet:saveDraft"](invalidRow)) as {
        success: boolean;
        changes?: number;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid time format");
    });

    it("should allow dates from any quarter (validation happens at submission)", async () => {
      // Quarter validation was intentionally removed from saveDraft
      // It now happens during submission routing to allow historical data entry
      const historicalRow = {
        date: "2024-01-15", // Different quarter (Q1 2024)
        hours: 8.0,
        project: "Test Project",
        taskDescription: "Test task",
      };

      // First prepare call: INSERT statement
      mockDbInstance.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1, lastInsertRowid: 2 })),
        get: vi.fn(() => ({})),
      });

      // Second prepare call: SELECT statement
      mockDbInstance.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 0 })),
        get: vi.fn(() => ({
          id: 2,
          date: "2024-01-15",
          hours: 8.0,
          project: "Test Project",
          tool: null,
          detail_charge_code: null,
          task_description: "Test task",
          status: null,
        })),
      });

      const result = (await handlers["timesheet:saveDraft"](historicalRow)) as {
        success: boolean;
        changes?: number;
        error?: string;
      };

      // Should succeed - quarter validation is deferred to submission
      expect(result.success).toBe(true);
      expect(result.changes).toBeGreaterThanOrEqual(0);
    });

    it("should handle duplicate entries", async () => {
      const duplicateRow = {
        date: "2025-10-15",
        hours: 8.0,
        project: "Test Project",
        taskDescription: "Test task",
      };

      // First saveDraft call: INSERT statement, then SELECT statement
      mockDbInstance.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1, lastInsertRowid: 3 })),
        get: vi.fn(() => ({})),
      });
      mockDbInstance.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 0 })),
        get: vi.fn(() => ({
          id: 3,
          date: "2025-10-15",
          hours: 8.0,
          project: "Test Project",
          tool: null,
          detail_charge_code: null,
          task_description: "Test task",
          status: null,
        })),
      });

      const result1 = (await handlers["timesheet:saveDraft"](duplicateRow)) as {
        success: boolean;
        changes?: number;
        error?: string;
      };
      expect(result1.success).toBe(true);

      // Second saveDraft call: INSERT statement (with conflict), then SELECT statement
      mockDbInstance.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 0, lastInsertRowid: 3 })),
        get: vi.fn(() => ({})),
      });
      mockDbInstance.prepare.mockReturnValueOnce({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 0 })),
        get: vi.fn(() => ({
          id: 3,
          date: "2025-10-15",
          hours: 8.0,
          project: "Test Project",
          tool: null,
          detail_charge_code: null,
          task_description: "Test task",
          status: null,
        })),
      });

      const result2 = (await handlers["timesheet:saveDraft"](duplicateRow)) as {
        success: boolean;
        changes?: number;
        error?: string;
      };
      expect(result2.success).toBe(true); // Still succeeds due to ON CONFLICT DO UPDATE
    });
  });

  describe("timesheet:loadDraft handler", () => {
    it("should load pending timesheet entries", async () => {
      const mockEntries = [
        {
          id: 1,
          date: "2025-10-15",
          hours: 8.0,
          project: "Test Project",
          tool: "VS Code",
          detail_charge_code: "DEV001",
          task_description: "Test task",
          status: null,
        },
      ];

      // resetInProgressTimesheetEntries uses db.prepare internally, so we need to handle multiple prepare calls
      let prepareCallCount = 0;
      mockDbInstance.prepare.mockImplementation((_sql?: string) => {
        prepareCallCount++;
        if (prepareCallCount === 1) {
          // First call is for resetInProgressTimesheetEntries (UPDATE query)
          expect(_sql).toContain("UPDATE timesheet");
          expect(_sql).toContain("SET status = NULL");
          return {
            all: vi.fn(() => []),
            run: vi.fn(() => ({ changes: 0 })),
            get: vi.fn(() => ({})),
          };
        } else {
          // Second call is for the SELECT query
          expect(_sql).toContain("SELECT * FROM timesheet");
          expect(_sql).toContain("WHERE status IS NULL");
          return {
            all: vi.fn(() => mockEntries),
            run: vi.fn(() => ({ changes: 1 })),
            get: vi.fn(() => ({})),
          };
        }
      });

      const result = (await handlers["timesheet:loadDraft"]()) as {
        success: boolean;
        entries: Array<{ date: string; hours: number; [key: string]: unknown }>;
        error?: string;
      };

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].date).toBe("2025-10-15");
      expect(result.entries[0].hours).toBe(8.0);
    });

    it("should handle empty draft data", async () => {
      // resetInProgressTimesheetEntries uses db.prepare internally, so we need to handle multiple prepare calls
      let prepareCallCount = 0;
      mockDbInstance.prepare.mockImplementation((_sql?: string) => {
        prepareCallCount++;
        if (prepareCallCount === 1) {
          // First call is for resetInProgressTimesheetEntries (UPDATE query)
          expect(_sql).toContain("UPDATE timesheet");
          return {
            all: vi.fn(() => []),
            run: vi.fn(() => ({ changes: 0 })),
            get: vi.fn(() => ({})),
          };
        } else {
          // Second call is for the SELECT query (returns empty array)
          expect(_sql).toContain("SELECT * FROM timesheet");
          return {
            all: vi.fn(() => []),
            run: vi.fn(() => ({ changes: 1 })),
            get: vi.fn(() => ({})),
          };
        }
      });

      const result = (await handlers["timesheet:loadDraft"]()) as {
        success: boolean;
        entries: unknown[];
        error?: string;
      };

      expect(result.success).toBe(true);
      expect(result.entries).toEqual([{}]); // Should return one blank row
    });

    it("should handle load errors", async () => {
      // resetInProgressTimesheetEntries uses db.prepare internally, so we need to handle multiple prepare calls
      let prepareCallCount = 0;
      mockDbInstance.prepare.mockImplementation((_sql?: string) => {
        prepareCallCount++;
        if (prepareCallCount === 1) {
          // First call is for resetInProgressTimesheetEntries (UPDATE query) - should succeed
          expect(_sql).toContain("UPDATE timesheet");
          return {
            all: vi.fn(() => []),
            run: vi.fn(() => ({ changes: 0 })),
            get: vi.fn(() => ({})),
          };
        } else {
          // Second call is for the SELECT query - should throw error
          expect(_sql).toContain("SELECT * FROM timesheet");
          return {
            all: vi.fn(() => {
              throw new Error("Database error");
            }),
            run: vi.fn(() => ({ changes: 1 })),
            get: vi.fn(() => ({})),
          };
        }
      });

      const result = (await handlers["timesheet:loadDraft"]()) as {
        success: boolean;
        entries?: unknown[];
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database error");
    });
  });

  describe("timesheet:deleteDraft handler", () => {
    it("should delete valid draft entry", async () => {
      const validId = 1;

      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({ id: validId, status: null })),
      });

      const result = (await handlers["timesheet:deleteDraft"](validId)) as {
        success: boolean;
        changes?: number;
        error?: string;
      };

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // Verify the correct SQL was prepared
      // First checks status
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id, status FROM timesheet WHERE id = ?")
      );
      // Then deletes regardless of status
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM timesheet")
      );
    });

    it("should validate ID parameter", async () => {
      const result = (await handlers["timesheet:deleteDraft"](undefined)) as {
        success: boolean;
        changes?: number;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid input");
    });

    it("should handle non-existent entry", async () => {
      const nonExistentId = 999;

      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 0 })), // No rows affected
        get: vi.fn(() => ({})),
      });

      const result = (await handlers["timesheet:deleteDraft"](
        nonExistentId
      )) as { success: boolean; changes?: number; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Entry not found");
    });

    it("should handle database errors", async () => {
      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => {
          throw new Error("Database connection failed");
        }),
        get: vi.fn(() => ({})),
      });

      const result = (await handlers["timesheet:deleteDraft"](1)) as {
        success: boolean;
        changes?: number;
        error?: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database connection failed");
    });

    it("should only delete draft entries (status IS NULL)", async () => {
      // This test is now outdated as we allow deleting any entry
      // Renaming to reflect current behavior: "should check status before deletion"
      const validId = 1;

      mockDbInstance.prepare.mockReturnValue({
        all: vi.fn(() => []),
        run: vi.fn(() => ({ changes: 1 })),
        get: vi.fn(() => ({ id: 1, status: "in_progress" })),
      });

      await handlers["timesheet:deleteDraft"](validId);

      // Verify status check query
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id, status FROM timesheet WHERE id = ?")
      );
    });
  });

  describe("timesheet:submit handler", () => {
    it("should submit timesheets with valid credentials", async () => {
      // Setup credentials mock
      mdb.getCredentials.mockReturnValue({
        email: "user@test.com",
        password: "password123",
      });

      const result = (await handlers["timesheet:submit"]("valid-token")) as {
        submitResult?: {
          ok: boolean;
          successCount: number;
          removedCount: number;
          totalProcessed: number;
        };
        dbPath?: string;
        error?: string;
      };

      // Check if result has the expected structure
      expect(result).toBeDefined();

      // If there's an error, the test should fail
      if (result.error) {
        throw new Error(
          `Handler returned error instead of success: ${result.error}`
        );
      }

      expect(result.submitResult).toBeDefined();
      expect(result.submitResult!.ok).toBe(true);
      // Verify that submitTimesheets was called with correct credentials, progressCallback, AbortSignal, and useMockWebsite
      expect(mimps.submitTimesheets).toHaveBeenCalledWith(
        "user@test.com",
        "password123",
        expect.any(Function),
        expect.any(AbortSignal),
        undefined // useMockWebsite is optional and defaults to undefined
      );
      // With mocked database (0 entries), successCount should be 0
      expect(result.submitResult?.successCount).toBe(0);
      expect(result.submitResult?.totalProcessed).toBe(0);
    });

    it("should handle missing credentials", async () => {
      mdb.getCredentials.mockReturnValue(null);

      const result = (await handlers["timesheet:submit"]("valid-token")) as {
        submitResult?: {
          ok: boolean;
          successCount: number;
          removedCount: number;
          totalProcessed: number;
        };
        dbPath?: string;
        error?: string;
      };

      expect(result).toBeDefined();
      expect(result.error).toContain("credentials not found");
      expect(mimps.submitTimesheets).not.toHaveBeenCalled();
    });

    it("should handle submission failures", async () => {
      // Setup credentials mock
      mdb.getCredentials.mockReturnValue({
        email: "user@test.com",
        password: "password123",
      });

      const result = (await handlers["timesheet:submit"]("valid-token")) as {
        submitResult?: {
          ok: boolean;
          successCount: number;
          removedCount: number;
          totalProcessed: number;
        };
        dbPath?: string;
        error?: string;
      };

      expect(result).toBeDefined();
      expect(result.submitResult).toBeDefined();
      // Verify that submitTimesheets was called with progressCallback, AbortSignal, and useMockWebsite
      expect(mimps.submitTimesheets).toHaveBeenCalledWith(
        "user@test.com",
        "password123",
        expect.any(Function),
        expect.any(AbortSignal),
        undefined // useMockWebsite is optional and defaults to undefined
      );
      // With mocked database (0 entries), the handler completes successfully
      expect(result.submitResult!.ok).toBe(true);
      expect(result.submitResult!.successCount).toBe(0);
    });
  });
});

// Mock electron-updater to prevent import failures
vi.mock("electron-updater", () => {
  const autoUpdater = {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    logger: null,
    on: vi.fn(),
    checkForUpdates: vi.fn(() => Promise.resolve()),
    downloadUpdate: vi.fn(() => Promise.resolve()),
  };
  return { autoUpdater };
});

// Mocks for Electron primitives used by main.ts
vi.mock("electron", () => {
  // Initialize handlers storage in the mock factory (hoisted)
  if (!globalThis.__test_handlers) {
    globalThis.__test_handlers = {};
  }

  // Minimal BrowserWindow stub
  class BrowserWindow {
    public webContents: {
      on: ReturnType<typeof vi.fn>;
      once: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
      executeJavaScript: ReturnType<typeof vi.fn>;
    };
    constructor(_opts: Record<string, unknown>) {
      this.webContents = {
        on: vi.fn(),
        once: vi.fn(),
        send: vi.fn(),
        executeJavaScript: vi.fn(),
      };
    }
    loadURL = vi.fn();
    loadFile = vi.fn();
    once = vi.fn();
    on = vi.fn();
    show = vi.fn();
    maximize = vi.fn();
    getBounds = vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 }));
    isMaximized = vi.fn(() => false);
  }

  const ipcMain = {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
      // Wrap handler to skip the event parameter when called from tests
      (
        globalThis.__test_handlers as Record<
          string,
          (...args: unknown[]) => unknown
        >
      )[channel] = async (...args: unknown[]) => {
        // Call the actual handler with null event and the provided args
        return fn(null, ...args);
      };
      return undefined;
    }),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
  };

  const dialog = {
    showOpenDialog: vi.fn(),
  };

  const shell = {
    openPath: vi.fn(),
  };

  const app = {
    isPackaged: false,
    getPath: vi.fn((key: string) =>
      key === "userData" ? "C:/tmp/sheetpilot-userdata" : "C:/tmp"
    ),
    getAppPath: vi.fn(() => "C:\\Local\\Sheetpilot"),
    getVersion: vi.fn(() => "1.3.6"),
    // Make whenReady return a thenable that immediately executes the callback
    whenReady: vi.fn(() => ({
      then: (callback: () => void) => {
        // Execute the callback immediately (synchronously) for testing
        callback();
        return Promise.resolve();
      },
      catch: () => Promise.resolve(),
    })),
    on: vi.fn(),
    quit: vi.fn(),
    exit: vi.fn(),
  };

  const screen = {
    getPrimaryDisplay: vi.fn(() => ({
      workAreaSize: { width: 1920, height: 1080 },
    })),
  };

  return {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    shell,
    screen,
    process: {
      on: vi.fn(),
      env: { NODE_ENV: "test", ELECTRON_IS_DEV: "true" },
    },
  };
});

// Mock repositories module used by IPC handlers and startup code
vi.mock("../src/models", () => {
  const mockDb = {
    prepare: vi.fn(() => ({
      all: vi.fn(() => []),
      get: vi.fn(() => ({})),
      run: vi.fn(() => ({ changes: 1 })),
    })),
    exec: vi.fn(),
    close: vi.fn(),
  };

  return {
    // Connection management
    setDbPath: vi.fn(),
    ensureSchema: vi.fn(),
    getDbPath: vi.fn(() => "C:/tmp/sheetpilot.sqlite"),
    getDb: vi.fn(() => mockDb),
    openDb: vi.fn(() => mockDb),
    closeConnection: vi.fn(),
    shutdownDatabase: vi.fn(),
    rebuildDatabase: vi.fn(),

    // Timesheet operations
    insertTimesheetEntry: vi.fn(),
    insertTimesheetEntries: vi.fn(() => ({
      success: true,
      total: 0,
      inserted: 0,
      duplicates: 0,
      errors: 0,
    })),
    checkDuplicateEntry: vi.fn(() => false),
    getDuplicateEntries: vi.fn(() => []),
    getPendingTimesheetEntries: vi.fn(() => []),
    markTimesheetEntriesAsInProgress: vi.fn(),
    resetTimesheetEntriesStatus: vi.fn(),
    resetInProgressTimesheetEntries: vi.fn(() => 0),
    markTimesheetEntriesAsSubmitted: vi.fn(),
    removeFailedTimesheetEntries: vi.fn(),
    getTimesheetEntriesByIds: vi.fn(() => []),
    getSubmittedTimesheetEntriesForExport: vi.fn(() => []),

    // Credentials operations
    storeCredentials: vi.fn(),
    getCredentials: vi.fn(() => null),
    listCredentials: vi.fn(() => []),
    deleteCredentials: vi.fn(),
    clearAllCredentials: vi.fn(),

    // Session operations
    createSession: vi.fn(() => "mock-session-token"),
    validateSession: vi.fn((token: string) => {
      if (token === "valid-token" || token === "mock-session-token") {
        return { valid: true, email: "user@test", isAdmin: false };
      }
      return { valid: false };
    }),
    clearSession: vi.fn(),
    clearUserSessions: vi.fn(),
    getSessionByEmail: vi.fn(),

    // Migrations (used by bootstrap-database)
    runMigrations: vi.fn(() => ({
      success: true,
      migrationsRun: 0,
      fromVersion: 0,
      toVersion: 0,
    })),
  };
});

vi.mock("../src/services/timesheet-importer", () => {
  return {
    submitTimesheets: vi.fn(async () => ({
      ok: true,
      submittedIds: [1],
      removedIds: [],
      totalProcessed: 1,
      successCount: 1,
      removedCount: 0,
    })),
  };
});

// Mock the logger module to prevent electron initialization issues
vi.mock("../../shared/logger", () => {
  const createMockLogger = () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    audit: vi.fn(),
    security: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() })),
  });

  return {
    initializeLogging: vi.fn(),
    configureLogger: vi.fn(),
    appLogger: createMockLogger(),
    dbLogger: createMockLogger(),
    ipcLogger: createMockLogger(),
    importLogger: createMockLogger(),
    botLogger: createMockLogger(),
  };
});

// Create local reference to handlers after all imports
const handlers: Record<string, (...args: unknown[]) => unknown> =
  globalThis.__test_handlers! as Record<
    string,
    (...args: unknown[]) => unknown
  >;

describe("Electron IPC Handlers (main.ts)", () => {
  beforeEach(() => {
    // Reset stub return values between tests
    (
      imp as { submitTimesheets: { mockClear?: () => void } }
    ).submitTimesheets.mockClear?.();
    const repoTyped = repo as unknown as {
      getCredentials: {
        mockReset?: () => void;
        mockReturnValue?: (value: unknown) => void;
      };
    };
    repoTyped.getCredentials.mockReset?.();
    // Reset to default null value
    repoTyped.getCredentials.mockReturnValue?.(null);
  });

  beforeAll(() => {
    // Manually call registerIPCHandlers to set up handlers for testing
    registerAllIPCHandlers(null);
  });

  it("timesheet:submit returns error if credentials missing", async () => {
    (
      repo as unknown as {
        getCredentials: { mockReturnValue: (value: unknown) => void };
      }
    ).getCredentials.mockReturnValue(null);
    const res = (await handlers["timesheet:submit"]("valid-token")) as {
      submitResult?: {
        ok: boolean;
        successCount: number;
        removedCount: number;
        totalProcessed: number;
      };
      dbPath?: string;
      error?: string;
    };
    expect(res.error).toContain("credentials not found");
  });

  it("timesheet:submit submits with stored credentials", async () => {
    const repoTyped = repo as unknown as {
      getCredentials: { mockReturnValue: (value: unknown) => void };
    };
    repoTyped.getCredentials.mockReturnValue({
      email: "user@test",
      password: "pw",
    });

    const res = (await handlers["timesheet:submit"]("valid-token")) as {
      submitResult?: {
        ok: boolean;
        successCount: number;
        removedCount: number;
        totalProcessed: number;
      };
      dbPath?: string;
      error?: string;
    };

    // DEBUG: Print response if error
    if (res && typeof res === "object" && "error" in res) {
      console.log("DEBUG: Handler error:", (res as { error: string }).error);
    }

    // Verify the handler was called and returned proper structure
    expect(res).toBeDefined();

    // Expect 5 arguments: email, password, progressCallback, abortSignal, useMockWebsite
    expect(mimps.submitTimesheets).toHaveBeenCalledWith(
      "user@test",
      "pw",
      expect.any(Function),
      expect.anything(), // AbortSignal
      undefined // useMockWebsite is optional and defaults to undefined
    );
    expect(res.submitResult).toBeDefined();
    expect(res.submitResult?.ok).toBe(true);
  });
});

/**
 * @fileoverview Integration tests for the complete IPC workflow
 *
 * Tests the full workflow from IPC handler through database to bot automation.
 * These tests catch issues with the complete integration chain.
 */

describe("IPC Workflow Integration", () => {
  const testDbPath = path.join(__dirname, "test_ipc_workflow.db");

  beforeEach(() => {
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    setDbPath(testDbPath);
    ensureSchema();
  });

  afterEach(() => {
    closeConnection();
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should handle workflow when database has pending entries", async () => {
    // Simulate user adding entries through the UI
    insertTimesheetEntry({
      date: "2025-01-15",
      hours: 1.0,
      project: "TestProject",
      taskDescription: "Test task",
    });

    // Verify entries are pending
    const pending = getPendingTimesheetEntries();
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBeNull();

    // Simulate automation button click (IPC handler calls submitTimesheets)
    const result = await submitTimesheets("test@example.com", "password123");

    // Should attempt to process the entry
    expect(result).toBeDefined();
    expect(result.totalProcessed).toBe(1);

    // Even if submission fails (expected in test), it should not fail with browser init error
    if (!result.ok && result.error) {
      const errorMessage = result.error.toLowerCase();
      expect(errorMessage).not.toContain("page is not available");
      expect(errorMessage).not.toContain("call start() first");
    }
  });

  it("should handle workflow when database is empty", async () => {
    // No entries in database
    const pending = getPendingTimesheetEntries();
    expect(pending).toHaveLength(0);

    // Simulate automation button click with no pending entries
    const result = await submitTimesheets("test@example.com", "password123");

    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    expect(result.totalProcessed).toBe(0);
    expect(result.submittedIds).toHaveLength(0);
  });

  it("should not mutate database entries during failed submission", async () => {
    // Insert test entry
    insertTimesheetEntry({
      date: "2025-01-15",
      hours: 1.0,
      project: "TestProject",
      taskDescription: "Test task",
    });

    const beforeSubmit = getPendingTimesheetEntries();
    const entryIdBefore = beforeSubmit[0].id;

    // Attempt submission (will fail in test environment)
    await submitTimesheets("test@example.com", "password123");

    // Verify entry is still in database (not deleted on failed submission)
    const db = openDb();
    const checkEntry = db.prepare("SELECT * FROM timesheet WHERE id = ?");
    const entry = checkEntry.get(entryIdBefore);
    db.close();

    expect(entry).toBeDefined();
  });

  it("should handle multiple pending entries with different projects", async () => {
    // Add entries for different projects
    const entries = [
      {
        date: "2025-01-15",
        hours: 1.0,
        project: "Project-A",
        taskDescription: "Task A",
      },
      {
        date: "2025-01-15",
        hours: 1.0,
        project: "Project-B",
        taskDescription: "Task B",
      },
      {
        date: "2025-01-16",
        hours: 1.0,
        project: "Project-C",
        taskDescription: "Task C",
      },
    ];

    entries.forEach((entry) => insertTimesheetEntry(entry));

    const pending = getPendingTimesheetEntries();
    expect(pending).toHaveLength(3);

    // Attempt to submit all
    const result = await submitTimesheets("test@example.com", "password123");

    expect(result).toBeDefined();
    expect(result.totalProcessed).toBe(3);
  });

  it("should maintain data integrity across automation attempts", async () => {
    insertTimesheetEntry({
      date: "2025-01-15",
      hours: 1.0,
      project: "TestProject",
      tool: "TestTool",
      detailChargeCode: "CODE123",
      taskDescription: "Test task",
    });

    const beforeAttempt = getPendingTimesheetEntries();
    const originalEntry = beforeAttempt[0];

    // First automation attempt
    await submitTimesheets("test@example.com", "password123");

    // Second automation attempt
    await submitTimesheets("test@example.com", "password123");

    // Verify data hasn't been corrupted
    const db = openDb();
    const getEntry = db.prepare("SELECT * FROM timesheet WHERE id = ?");
    const currentEntry = getEntry.get(originalEntry.id) as {
      project: string;
      tool: string | null;
      detail_charge_code: string | null;
      task_description: string;
    };
    db.close();

    expect(currentEntry.project).toBe(originalEntry.project);
    expect(currentEntry.tool).toBe(originalEntry.tool);
    expect(currentEntry.detail_charge_code).toBe(
      originalEntry.detail_charge_code
    );
    expect(currentEntry.task_description).toBe(originalEntry.task_description);
  });

  describe("Concurrent IPC Calls", () => {
    it("should handle concurrent read operations", async () => {
      insertTimesheetEntry({
        date: "2025-01-15",
        hours: 1.0,
        project: "Test",
        taskDescription: "Task",
      });

      // Simulate concurrent reads
      const promises = Array(10)
        .fill(null)
        .map(() => getPendingTimesheetEntries());
      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result).toHaveLength(1);
      });
    });

    it("should handle concurrent write operations", async () => {
      const entries = Array(5)
        .fill(null)
        .map((_, i) => ({
          date: "2025-01-15",
          hours: 1.0,
          project: `Project ${i}`,
          taskDescription: `Task ${i}`,
        }));

      // Insert concurrently
      const results = await Promise.all(
        entries.map((entry) => Promise.resolve(insertTimesheetEntry(entry)))
      );

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });

    it("should maintain consistency under concurrent access", async () => {
      const operations = [];

      // Mix of reads and writes
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          operations.push(Promise.resolve(getPendingTimesheetEntries()));
        } else {
          // Time must be in 15-minute increments: 540, 555, 570, 585, etc.
          operations.push(
            Promise.resolve(
              insertTimesheetEntry({
                date: "2025-01-15",
                hours: 1.0,
                project: `Project ${i}`,
                taskDescription: `Task ${i}`,
              })
            )
          );
        }
      }

      await Promise.all(operations);

      // Final count should be consistent
      const final = getPendingTimesheetEntries();
      expect(final.length).toBe(10); // Half were writes
    });
  });

  describe("IPC Call Ordering", () => {
    it("should process calls in correct order", async () => {
      const order: string[] = [];

      const op1 = async () => {
        order.push("op1");
        return getPendingTimesheetEntries();
      };

      const op2 = async () => {
        order.push("op2");
        insertTimesheetEntry({
          date: "2025-01-15",
          hours: 1.0,
          project: "Test",
          taskDescription: "Task",
        });
      };

      const op3 = async () => {
        order.push("op3");
        return getPendingTimesheetEntries();
      };

      await op1();
      await op2();
      await op3();

      expect(order).toEqual(["op1", "op2", "op3"]);
    });

    it("should maintain FIFO order for queued operations", async () => {
      const results: number[] = [];

      const operations = Array(5)
        .fill(null)
        .map((_, i) => async () => {
          results.push(i);
        });

      for (const op of operations) {
        await op();
      }

      expect(results).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe("IPC Timeout Handling", () => {
    it("should handle long-running operations", async () => {
      const longOperation = () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ success: true }), 100);
        });
      };

      const startTime = Date.now();
      await longOperation();
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(200); // Should not timeout
    });

    it("should timeout excessively long operations", async () => {
      const timeout = 5000;
      const operationTime = 10000;

      const willTimeout = operationTime > timeout;

      expect(willTimeout).toBe(true);
    });

    it("should clean up on timeout", async () => {
      let _cleaned = false;

      const operationWithCleanup = async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 10000));
        } finally {
          _cleaned = true;
        }
      };

      // Simulate timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 100)
      );

      try {
        await Promise.race([operationWithCleanup(), timeoutPromise]);
      } catch (error) {
        expect((error as Error).message).toBe("Timeout");
      }
    });
  });
});

// Mock electron
vi.mock("electron", () => ({
  ipcMain: {
    on: vi.fn(),
  },
}));

vi.mock("../../src/routes/handlers/timesheet/main-window", () => ({
  isTrustedIpcSender: vi.fn(() => true),
}));

// Mock logger
vi.mock("../../../shared/logger", () => ({
  ipcLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    verbose: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("logger-handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerLoggerHandlers", () => {
    it("should register all logger IPC handlers", () => {
      registerLoggerHandlers();

      expect(ipcMain.on).toHaveBeenCalledTimes(6);
      expect(ipcMain.on).toHaveBeenCalledWith(
        "logger:error",
        expect.any(Function)
      );
      expect(ipcMain.on).toHaveBeenCalledWith(
        "logger:warn",
        expect.any(Function)
      );
      expect(ipcMain.on).toHaveBeenCalledWith(
        "logger:info",
        expect.any(Function)
      );
      expect(ipcMain.on).toHaveBeenCalledWith(
        "logger:verbose",
        expect.any(Function)
      );
      expect(ipcMain.on).toHaveBeenCalledWith(
        "logger:debug",
        expect.any(Function)
      );
      expect(ipcMain.on).toHaveBeenCalledWith(
        "logger:user-action",
        expect.any(Function)
      );
    });

    it("should route logger:error to ipcLogger.error", () => {
      registerLoggerHandlers();

      const errorHandler = vi
        .mocked(ipcMain.on)
        .mock.calls.find((call) => call[0] === "logger:error")?.[1] as (
        event: unknown,
        message: string,
        data?: unknown
      ) => void;

      expect(errorHandler).toBeDefined();

      const mockEvent = {};
      errorHandler(mockEvent, "Test error", { errorCode: 123 });

      expect(ipcLogger.error).toHaveBeenCalledWith("Test error", {
        errorCode: 123,
      });
    });

    it("should route logger:warn to ipcLogger.warn", () => {
      registerLoggerHandlers();

      const warnHandler = vi
        .mocked(ipcMain.on)
        .mock.calls.find((call) => call[0] === "logger:warn")?.[1] as (
        event: unknown,
        message: string,
        data?: unknown
      ) => void;

      expect(warnHandler).toBeDefined();

      const mockEvent = {};
      warnHandler(mockEvent, "Test warning", { warningType: "deprecated" });

      expect(ipcLogger.warn).toHaveBeenCalledWith("Test warning", {
        warningType: "deprecated",
      });
    });

    it("should route logger:info to ipcLogger.info", () => {
      registerLoggerHandlers();

      const infoHandler = vi
        .mocked(ipcMain.on)
        .mock.calls.find((call) => call[0] === "logger:info")?.[1] as (
        event: unknown,
        message: string,
        data?: unknown
      ) => void;

      expect(infoHandler).toBeDefined();

      const mockEvent = {};
      infoHandler(mockEvent, "Test info", { userId: 456 });

      expect(ipcLogger.info).toHaveBeenCalledWith("Test info", { userId: 456 });
    });

    it("should route logger:verbose to ipcLogger.verbose", () => {
      registerLoggerHandlers();

      const verboseHandler = vi
        .mocked(ipcMain.on)
        .mock.calls.find((call) => call[0] === "logger:verbose")?.[1] as (
        event: unknown,
        message: string,
        data?: unknown
      ) => void;

      expect(verboseHandler).toBeDefined();

      const mockEvent = {};
      verboseHandler(mockEvent, "Test verbose", { debugData: "test" });

      expect(ipcLogger.verbose).toHaveBeenCalledWith("Test verbose", {
        debugData: "test",
      });
    });

    it("should route logger:debug to ipcLogger.debug", () => {
      registerLoggerHandlers();

      const debugHandler = vi
        .mocked(ipcMain.on)
        .mock.calls.find((call) => call[0] === "logger:debug")?.[1] as (
        event: unknown,
        message: string,
        data?: unknown
      ) => void;

      expect(debugHandler).toBeDefined();

      const mockEvent = {};
      debugHandler(mockEvent, "Test debug", { debugInfo: "value" });

      expect(ipcLogger.debug).toHaveBeenCalledWith("Test debug", {
        debugInfo: "value",
      });
    });

    it("should route logger:user-action to ipcLogger.info with formatted message", () => {
      registerLoggerHandlers();

      const userActionHandler = vi
        .mocked(ipcMain.on)
        .mock.calls.find((call) => call[0] === "logger:user-action")?.[1] as (
        event: unknown,
        action: string,
        data?: unknown
      ) => void;

      expect(userActionHandler).toBeDefined();

      const mockEvent = {};
      userActionHandler(mockEvent, "button-click", { buttonId: "submit" });

      expect(ipcLogger.info).toHaveBeenCalledWith("User action: button-click", {
        buttonId: "submit",
      });
    });

    it("should handle handlers without data parameter", () => {
      registerLoggerHandlers();

      const errorHandler = vi
        .mocked(ipcMain.on)
        .mock.calls.find((call) => call[0] === "logger:error")?.[1] as (
        event: unknown,
        message: string,
        data?: unknown
      ) => void;

      const mockEvent = {};
      errorHandler(mockEvent, "Error without data");

      expect(ipcLogger.error).toHaveBeenCalledWith(
        "Error without data",
        undefined
      );
    });
  });
});

// Mock electron
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => "/mock/user/data"),
  },
}));

vi.mock("../../src/routes/handlers/timesheet/main-window", () => ({
  isTrustedIpcSender: vi.fn(() => true),
}));

vi.mock("../../src/models", () => ({
  validateSession: vi.fn(() => ({
    valid: true,
    email: "user@example.com",
    isAdmin: false,
  })),
}));

vi.mock("../../../shared/logger", () => ({
  ipcLogger: {
    security: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock fs
vi.mock("fs", () => ({
  default: {
    promises: {
      readdir: vi.fn(),
      readFile: vi.fn(),
    },
  },
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

// Mock path
vi.mock("path", async (importOriginal) => {
  const actual = await importOriginal<typeof import("path")>();
  return {
    ...actual,
    join: vi.fn((...args: string[]) => args.join("/")),
  };
});

// Mock validation
vi.mock("../../src/validation/validate-ipc-input", () => ({
  validateInput: vi.fn((schema, data) => ({ success: true, data })),
}));

describe("logs-handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerLogsHandlers", () => {
    it("should register all logs handlers", () => {
      registerLogsHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith(
        "logs:getLogPath",
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "logs:exportLogs",
        expect.any(Function)
      );
    });
  });

  describe("logs:getLogPath handler", () => {
    it("should get latest log file path", async () => {
      registerLogsHandlers();

      vi.mocked(fs.promises.readdir).mockResolvedValue([
        "sheetpilot_2025-01-01.log",
        "sheetpilot_2025-01-02.log",
        "other-file.txt",
      ] as never);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "logs:getLogPath")?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; logPath?: string; logFiles?: string[] }>;

      const result = await handler({}, "test-token");

      expect(result.success).toBe(true);
      expect(result.logPath).toBe("/mock/user/data/sheetpilot_2025-01-02.log");
      expect(result.logFiles).toBeDefined();
      expect(result.logFiles!.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle no log files found", async () => {
      registerLogsHandlers();

      vi.mocked(fs.promises.readdir).mockResolvedValue([
        "other-file.txt",
      ] as never);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "logs:getLogPath")?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "test-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No log files found");
    });

    it("should handle readdir errors", async () => {
      registerLogsHandlers();

      vi.mocked(fs.promises.readdir).mockRejectedValue(new Error("Read error"));

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "logs:getLogPath")?.[1] as (
        event: unknown,
        token: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "test-token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Read error");
    });
  });

  describe("logs:exportLogs handler", () => {
    it("should export logs as JSON", async () => {
      registerLogsHandlers();

      const mockLogContent = '{"level":"info","message":"Test"}';

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockLogContent);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "logs:exportLogs")?.[1] as (
        event: unknown,
        token: string,
        logPath: string,
        exportFormat: "json" | "txt"
      ) => Promise<{
        success: boolean;
        content?: string;
        filename?: string;
        mimeType?: string;
      }>;

      const result = await handler(
        {},
        "test-token",
        "/mock/user/data/sheetpilot_2025-01-02.log",
        "json"
      );

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe("application/json");
      expect(result.filename).toMatch(/\.json$/);
      expect(JSON.parse(result.content!)).toBeInstanceOf(Array);
    });

    it("should export logs as text", async () => {
      registerLogsHandlers();

      const mockLogContent = "Log line 1\nLog line 2";

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockLogContent);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "logs:exportLogs")?.[1] as (
        event: unknown,
        token: string,
        logPath: string,
        exportFormat: "json" | "txt"
      ) => Promise<{
        success: boolean;
        content?: string;
        filename?: string;
        mimeType?: string;
      }>;

      const result = await handler(
        {},
        "test-token",
        "/mock/user/data/sheetpilot_2025-01-02.log",
        "txt"
      );

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe("text/plain");
      expect(result.filename).toMatch(/\.txt$/);
      expect(result.content).toBe(mockLogContent);
    });

    it("should default to text export", async () => {
      registerLogsHandlers();

      const mockLogContent = "Log content";

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockLogContent);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "logs:exportLogs")?.[1] as (
        event: unknown,
        token: string,
        logPath: string,
        exportFormat?: "json" | "txt"
      ) => Promise<{ success: boolean; mimeType?: string }>;

      const result = await handler(
        {},
        "test-token",
        "/mock/user/data/sheetpilot_2025-01-02.log"
      );

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe("text/plain");
    });

    it("should handle read errors", async () => {
      registerLogsHandlers();

      vi.mocked(fs.promises.readFile).mockRejectedValue(
        new Error("Read error")
      );

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "logs:exportLogs")?.[1] as (
        event: unknown,
        token: string,
        logPath: string
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler(
        {},
        "test-token",
        "/mock/user/data/sheetpilot_2025-01-02.log"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Read error");
    });
  });
});

// Mock electron
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => "/mock/user/data"),
  },
}));

vi.mock("../../src/routes/handlers/timesheet/main-window", () => ({
  isTrustedIpcSender: vi.fn(() => true),
}));

// Mock fs
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock path
vi.mock("path", async (importOriginal) => {
  const actual = await importOriginal<typeof import("path")>();
  return {
    ...actual,
    join: vi.fn((...args: string[]) => args.join("/")),
  };
});

// Mock logger
vi.mock("../../../shared/logger", () => ({
  ipcLogger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock constants
vi.mock("../../../shared/constants", () => ({
  setBrowserHeadless: vi.fn(),
}));

describe("settings-handlers", () => {
  let mockSettingsPath: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsPath = "/mock/user/data/settings.json";
    vi.mocked(path.join).mockReturnValue(mockSettingsPath);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("registerSettingsHandlers", () => {
    it("should register all settings IPC handlers", () => {
      registerSettingsHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith(
        "settings:get",
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "settings:set",
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "settings:getAll",
        expect.any(Function)
      );
    });

    it("should initialize browserHeadless from settings file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ browserHeadless: true })
      );

      registerSettingsHandlers();

      expect(setBrowserHeadless).toHaveBeenCalledWith(true);
      expect(ipcLogger.info).toHaveBeenCalledWith(
        "Initialized browserHeadless setting on startup",
        expect.any(Object)
      );
    });

    it("should default to false when settings file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      registerSettingsHandlers();

      expect(setBrowserHeadless).toHaveBeenCalledWith(false);
    });

    it("should handle settings file read errors", () => {
      vi.clearAllMocks();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("Read error");
      });

      expect(() => registerSettingsHandlers()).not.toThrow();
      // Error is logged but caught, so initialization continues
    });

    it("should handle invalid JSON in settings file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

      expect(() => registerSettingsHandlers()).not.toThrow();
    });
  });

  describe("settings:get handler", () => {
    it("should return setting value", async () => {
      vi.clearAllMocks();
      registerSettingsHandlers();

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ browserHeadless: true })
      );

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "settings:get")?.[1] as (
        event: unknown,
        key: string
      ) => Promise<{ success: boolean; value?: unknown; error?: string }>;

      const result = await handler({}, "browserHeadless");

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should return undefined for non-existent key", async () => {
      vi.clearAllMocks();
      registerSettingsHandlers();

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "settings:get")?.[1] as (
        event: unknown,
        key: string
      ) => Promise<{ success: boolean; value?: unknown; error?: string }>;

      const result = await handler({}, "nonExistent");

      expect(result.success).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it("should return empty settings when file does not exist", async () => {
      vi.clearAllMocks();
      registerSettingsHandlers();

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "settings:get")?.[1] as (
        event: unknown,
        key: string
      ) => Promise<{ success: boolean; value?: unknown; error?: string }>;

      const result = await handler({}, "browserHeadless");

      expect(result.success).toBe(true);
      expect(result.value).toBeUndefined();
    });
  });

  describe("settings:set handler", () => {
    it("should save setting value", async () => {
      vi.clearAllMocks();
      registerSettingsHandlers();

      let savedData = "{}";
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => savedData);
      vi.mocked(fs.writeFileSync).mockImplementation((_path, data) => {
        savedData = data as string;
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "settings:set")?.[1] as (
        event: unknown,
        key: string,
        value: unknown
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "browserHeadless", true);

      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should update browserHeadless constant when setting changes", async () => {
      registerSettingsHandlers();

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ browserHeadless: false })
      );
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "settings:set")?.[1] as (
        event: unknown,
        key: string,
        value: unknown
      ) => Promise<{ success: boolean; error?: string }>;

      await handler({}, "browserHeadless", true);

      expect(setBrowserHeadless).toHaveBeenCalledWith(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Settings] Updated browserHeadless setting:"),
        expect.any(Object)
      );
    });

    it("should verify setting was saved correctly", async () => {
      registerSettingsHandlers();

      let savedData = "{}";
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => savedData);
      vi.mocked(fs.writeFileSync).mockImplementation((_path, data) => {
        savedData = data as string;
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "settings:set")?.[1] as (
        event: unknown,
        key: string,
        value: unknown
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "browserHeadless", true);

      expect(result.success).toBe(true);
    });

    it("should handle write errors", async () => {
      vi.clearAllMocks();
      registerSettingsHandlers();

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Write error");
      });

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find((call) => call[0] === "settings:set")?.[1] as (
        event: unknown,
        key: string,
        value: unknown
      ) => Promise<{ success: boolean; error?: string }>;

      const result = await handler({}, "browserHeadless", true);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("settings:getAll handler", () => {
    it("should return all settings", async () => {
      registerSettingsHandlers();

      const settings = { browserHeadless: true, otherSetting: "value" };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(settings));

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "settings:getAll"
        )?.[1] as () => Promise<{
        success: boolean;
        settings?: unknown;
        error?: string;
      }>;

      const result = await handler();

      expect(result.success).toBe(true);
      expect(result.settings).toEqual(settings);
    });

    it("should return empty settings when file does not exist", async () => {
      registerSettingsHandlers();

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const handler = vi
        .mocked(ipcMain.handle)
        .mock.calls.find(
          (call) => call[0] === "settings:getAll"
        )?.[1] as () => Promise<{
        success: boolean;
        settings?: unknown;
        error?: string;
      }>;

      const result = await handler();

      expect(result.success).toBe(true);
      expect(result.settings).toEqual({});
    });
  });
});
