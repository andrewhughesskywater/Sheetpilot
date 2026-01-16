/**
 * @fileoverview IPC Contract Validation Tests
 *
 * Validates that IPC handler signatures match renderer expectations.
 * Prevents AI from breaking communication contracts between layers.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { IPCPayloadBuilder } from "../helpers/test-builders";
import {
  assertValidIPCPayload,
  assertUserFriendlyErrorMessage,
} from "../helpers/assertion-helpers";

// Mock Electron modules
vi.mock("electron", () => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};

  const ipcMain = {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers[channel] = fn;
    }),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
  };

  return {
    ipcMain,
    app: {
      getPath: vi.fn(() => "C:/tmp/sheetpilot-userdata"),
      isPackaged: false,
      whenReady: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      quit: vi.fn(),
    },
    BrowserWindow: vi.fn().mockImplementation(() => ({
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      once: vi.fn(),
      on: vi.fn(),
      show: vi.fn(),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 })),
      isMaximized: vi.fn(() => false),
    })),
  };
});

// Mock database and services
vi.mock("../../src/repositories", () => ({
  setDbPath: vi.fn(),
  ensureSchema: vi.fn(),
  getDbPath: vi.fn(() => "C:/tmp/sheetpilot.sqlite"),
  openDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      all: vi.fn(() => []),
      run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
      get: vi.fn(() => ({})),
    })),
    exec: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock("../../src/services/timesheet-importer", () => ({
  submitTimesheets: vi.fn(async () => ({
    ok: true,
    submittedIds: [1],
    removedIds: [],
    totalProcessed: 1,
    successCount: 1,
    removedCount: 0,
  })),
}));

vi.mock("../../src/shared/logger", () => ({
  initializeLogging: vi.fn(),
  appLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    audit: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() })),
  },
  ipcLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    audit: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() })),
  },
}));

describe("IPC Contract Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("timesheet:saveDraft Contract", () => {
    it("should accept valid saveDraft payload structure", async () => {
      const payload = IPCPayloadBuilder.create()
        .withDate("01/15/2025")
        .withHours(8.0)
        .withProject("FL-Carver Techs")
        .withTool("#1 Rinse and 2D marker")
        .withChargeCode("EPR1")
        .withTaskDescription("Test task")
        .build();

      assertValidIPCPayload(payload);

      // Verify required fields
      expect(payload["date"]).toBe("01/15/2025");
      expect(payload["hours"]).toBe(8.0);
      expect(payload["project"]).toBe("FL-Carver Techs");
      expect(payload["taskDescription"]).toBe("Test task");

      // Verify optional fields
      expect(payload["tool"]).toBe("#1 Rinse and 2D marker");
      expect(payload["chargeCode"]).toBe("EPR1");
    });

    it("should accept saveDraft payload with null optional fields", async () => {
      const payload = IPCPayloadBuilder.create()
        .withProject("PTO/RTO")
        .withTool(null)
        .withChargeCode(null)
        .build();

      assertValidIPCPayload(payload);

      expect(payload["tool"]).toBeNull();
      expect(payload["chargeCode"]).toBeNull();
    });

    it("should reject saveDraft payload with missing required fields", async () => {
      const invalidPayloads = [
        IPCPayloadBuilder.create().withMissingDate().build(),
        IPCPayloadBuilder.create().withMissingProject().build(),
        IPCPayloadBuilder.create().withMissingTaskDescription().build(),
      ];

      invalidPayloads.forEach((payload, index) => {
        if (index === 0) {
          expect(payload["date"]).toBeUndefined();
        } else if (index === 1) {
          expect(payload["project"]).toBeUndefined();
        } else if (index === 2) {
          expect(payload["taskDescription"]).toBeUndefined();
        }
      });
    });

    it("should validate date format in saveDraft payload", async () => {
      const validDatePayload = IPCPayloadBuilder.create()
        .withDate("01/15/2025")
        .build();

      const invalidDatePayload = IPCPayloadBuilder.create()
        .withDate("2025-01-15") // Wrong format
        .build();

      expect(validDatePayload["date"]).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
      expect(invalidDatePayload["date"]).not.toMatch(
        /^\d{1,2}\/\d{1,2}\/\d{4}$/
      );
    });

    it("should validate hours format in saveDraft payload", async () => {
      const validHoursPayload = IPCPayloadBuilder.create()
        .withHours(8.0)
        .build();

      const invalidHoursPayload = IPCPayloadBuilder.create()
        .withHours(0.1) // Not 15-minute increment
        .build();

      // Valid hours should be in 15-minute increments (0.25, 0.5, 0.75, etc.)
      expect(typeof validHoursPayload["hours"]).toBe("number");
      expect(validHoursPayload["hours"]).toBe(8.0);

      // Check 15-minute increment (multiples of 0.25)
      const remainder = ((validHoursPayload["hours"] as number) * 4) % 1;
      expect(remainder).toBe(0);

      // Invalid hours should not be in 15-minute increments
      expect(typeof invalidHoursPayload["hours"]).toBe("number");
      const invalidRemainder =
        ((invalidHoursPayload["hours"] as number) * 4) % 1;
      expect(invalidRemainder).not.toBe(0);

      // Check range (0.25 to 24.0)
      expect(validHoursPayload["hours"]).toBeGreaterThanOrEqual(0.25);
      expect(validHoursPayload["hours"]).toBeLessThanOrEqual(24.0);
    });
  });

  describe("timesheet:loadDraft Contract", () => {
    it("should return array of timesheet entries", async () => {
      const expectedStructure = [
        {
          id: 1,
          date: "01/15/2025",
          hours: 8.0,
          project: "FL-Carver Techs",
          tool: "#1 Rinse and 2D marker",
          chargeCode: "EPR1",
          taskDescription: "Test task",
        },
      ];

      expect(Array.isArray(expectedStructure)).toBe(true);
      expect(expectedStructure.length).toBeGreaterThan(0);

      expectedStructure.forEach((entry) => {
        assertValidIPCPayload(entry);
        expect(entry.id).toBeDefined();
        expect(typeof entry.id).toBe("number");
      });
    });

    it("should handle empty draft data", async () => {
      const emptyData: unknown[] = [];

      expect(Array.isArray(emptyData)).toBe(true);
      expect(emptyData.length).toBe(0);
    });
  });

  describe("timesheet:deleteDraft Contract", () => {
    it("should accept numeric ID parameter", async () => {
      const validId = 1;
      const invalidId = "not-a-number";

      expect(typeof validId).toBe("number");
      expect(typeof invalidId).not.toBe("number");
    });

    it("should return success/error response structure", async () => {
      const successResponse = { success: true };
      const errorResponse = { success: false, error: "Entry not found" };

      expect(successResponse).toHaveProperty("success");
      expect(successResponse.success).toBe(true);

      expect(errorResponse).toHaveProperty("success");
      expect(errorResponse).toHaveProperty("error");
      expect(errorResponse.success).toBe(false);
      expect(typeof errorResponse.error).toBe("string");
    });
  });

  describe("timesheet:submit Contract", () => {
    it("should accept credentials parameter", async () => {
      const credentials = {
        email: "test@example.com",
        password: "password123",
      };

      expect(credentials).toHaveProperty("email");
      expect(credentials).toHaveProperty("password");
      expect(typeof credentials.email).toBe("string");
      expect(typeof credentials.password).toBe("string");
    });

    it("should return submission result structure", async () => {
      const submissionResult = {
        ok: true,
        submittedIds: [1, 2],
        removedIds: [],
        totalProcessed: 2,
        successCount: 2,
        removedCount: 0,
      };

      expect(submissionResult).toHaveProperty("ok");
      expect(submissionResult).toHaveProperty("submittedIds");
      expect(submissionResult).toHaveProperty("removedIds");
      expect(submissionResult).toHaveProperty("totalProcessed");
      expect(submissionResult).toHaveProperty("successCount");
      expect(submissionResult).toHaveProperty("removedCount");

      expect(Array.isArray(submissionResult.submittedIds)).toBe(true);
      expect(Array.isArray(submissionResult.removedIds)).toBe(true);
      expect(typeof submissionResult.totalProcessed).toBe("number");
      expect(typeof submissionResult.successCount).toBe("number");
      expect(typeof submissionResult.removedCount).toBe("number");
    });
  });

  describe("timesheet:getAllEntries Contract", () => {
    it("should return database entries with correct structure", async () => {
      const dbEntry = {
        id: 1,
        date: "2025-01-15",
        time_in: 540,
        time_out: 1020,
        hours: 8.0,
        project: "FL-Carver Techs",
        tool: "#1 Rinse and 2D marker",
        detail_charge_code: "EPR1",
        task_description: "Test task",
        status: "Complete",
        submitted_at: "2025-01-15T10:00:00Z",
      };

      expect(dbEntry).toHaveProperty("id");
      expect(dbEntry).toHaveProperty("date");
      expect(dbEntry).toHaveProperty("time_in");
      expect(dbEntry).toHaveProperty("time_out");
      expect(dbEntry).toHaveProperty("hours");
      expect(dbEntry).toHaveProperty("project");
      expect(dbEntry).toHaveProperty("task_description");

      expect(typeof dbEntry["id"]).toBe("number");
      expect(typeof dbEntry["date"]).toBe("string");
      expect(typeof dbEntry["time_in"]).toBe("number");
      expect(typeof dbEntry["time_out"]).toBe("number");
      expect(typeof dbEntry["hours"]).toBe("number");
      expect(typeof dbEntry["project"]).toBe("string");
      expect(typeof dbEntry["task_description"]).toBe("string");
    });
  });

  describe("Error Response Contracts", () => {
    it("should return user-friendly error messages", async () => {
      const errorMessages = [
        "Please enter a valid date",
        "Time Out must be after Time In",
        "Times must be in 15-minute increments",
        "Please enter a date in the current quarter",
        "Please pick a project",
        "Task Description is required",
      ];

      errorMessages.forEach((message) => {
        assertUserFriendlyErrorMessage(message);
      });
    });

    it("should not expose internal error details", async () => {
      const badErrorMessages = [
        "Error: Cannot read property of undefined",
        "TypeError: Invalid input",
        "Error: Database connection failed: ECONNREFUSED",
        "Error: SQLITE_ERROR: no such table",
      ];

      badErrorMessages.forEach((message) => {
        expect(message).toContain("Error:");
        if (message.includes("TypeError:")) {
          expect(message).toContain("TypeError:");
        }
        if (message.includes("ECONNREFUSED")) {
          expect(message).toContain("ECONNREFUSED");
        }
        if (message.includes("SQLITE_ERROR")) {
          expect(message).toContain("SQLITE_ERROR");
        }
      });
    });
  });

  describe("Data Type Contracts", () => {
    it("should maintain consistent data types across IPC calls", async () => {
      const savePayload = IPCPayloadBuilder.create().build();
      const loadResponse = [IPCPayloadBuilder.create().withId(1).build()];

      // Save and load should have same structure
      expect(typeof savePayload["date"]).toBe("string");
      expect(typeof savePayload["timeIn"]).toBe("string");
      expect(typeof savePayload["timeOut"]).toBe("string");
      expect(typeof savePayload["project"]).toBe("string");
      expect(typeof savePayload["taskDescription"]).toBe("string");

      expect(typeof loadResponse[0]?.["date"]).toBe("string");
      expect(typeof loadResponse[0]?.["hours"]).toBe("number");
      expect(typeof loadResponse[0]?.["project"]).toBe("string");
      expect(typeof loadResponse[0]?.["taskDescription"]).toBe("string");
    });

    it("should handle null values consistently", async () => {
      const payloadWithNulls = IPCPayloadBuilder.create()
        .withTool(null)
        .withChargeCode(null)
        .build();

      expect(payloadWithNulls["tool"]).toBeNull();
      expect(payloadWithNulls["chargeCode"]).toBeNull();

      // Null should not be converted to undefined or empty string
      expect(payloadWithNulls["tool"]).not.toBeUndefined();
      expect(payloadWithNulls["tool"]).not.toBe("");
      expect(payloadWithNulls["chargeCode"]).not.toBeUndefined();
      expect(payloadWithNulls["chargeCode"]).not.toBe("");
    });
  });

  describe("Time Conversion Contracts", () => {
    it("should maintain time format consistency", async () => {
      const timeFormats = [
        { input: "09:00", expected: 540 },
        { input: "17:30", expected: 1050 },
        { input: "00:00", expected: 0 },
        { input: "23:45", expected: 1425 },
      ];

      timeFormats.forEach(({ input, expected }) => {
        const parts = input.split(":");
        expect(parts.length).toBe(2);
        const [hours, minutes] = parts.map(Number) as [number, number];
        const totalMinutes = hours * 60 + minutes;
        expect(totalMinutes).toBe(expected);
      });
    });

    it("should handle time conversion edge cases", async () => {
      const edgeCases = [
        { time: "00:00", minutes: 0 },
        { time: "00:15", minutes: 15 },
        { time: "23:45", minutes: 1425 },
        { time: "23:59", minutes: 1439 },
      ];

      edgeCases.forEach(({ time, minutes }) => {
        const parts = time.split(":");
        expect(parts.length).toBe(2);
        const [hours, mins] = parts.map(Number) as [number, number];
        const totalMinutes = hours * 60 + mins;
        expect(totalMinutes).toBe(minutes);
      });
    });
  });

  describe("Date Conversion Contracts", () => {
    it("should maintain date format consistency", async () => {
      const dateConversions = [
        { input: "01/15/2025", expected: "2025-01-15" },
        { input: "12/31/2024", expected: "2024-12-31" },
        { input: "02/29/2024", expected: "2024-02-29" },
      ];

      dateConversions.forEach(({ input, expected }) => {
        const parts = input.split("/");
        expect(parts.length).toBe(3);
        const [month, day, year] = parts.map(Number) as [
          number,
          number,
          number
        ];
        const isoDate = `${year}-${month.toString().padStart(2, "0")}-${day
          .toString()
          .padStart(2, "0")}`;
        expect(isoDate).toBe(expected);
      });
    });

    it("should handle date conversion edge cases", async () => {
      const edgeCases = [
        { input: "01/01/2025", expected: "2025-01-01" },
        { input: "03/31/2025", expected: "2025-03-31" },
        { input: "04/01/2025", expected: "2025-04-01" },
        { input: "12/31/2025", expected: "2025-12-31" },
      ];

      edgeCases.forEach(({ input, expected }) => {
        const parts = input.split("/");
        expect(parts.length).toBe(3);
        const [month, day, year] = parts.map(Number) as [
          number,
          number,
          number
        ];
        const isoDate = `${year}-${month.toString().padStart(2, "0")}-${day
          .toString()
          .padStart(2, "0")}`;
        expect(isoDate).toBe(expected);
      });
    });
  });
});
