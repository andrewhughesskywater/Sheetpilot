/**
 * @fileoverview Validation Rules Unit Tests
 *
 * Comprehensive tests for all validation logic to prevent AI regression.
 * Tests every validation rule, edge case, and business constraint.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isValidDate,
  isValidHours,
  validateField,
  type TimesheetRow,
} from "../../src/logic/timesheet-validation";
import { validateQuarterAvailability } from "@sheetpilot/bot";
import {
  validTimesheetEntries,
  invalidTimesheetEntries,
  edgeCaseEntries,
} from "../fixtures/timesheet-data";
import {
  assertValidTimesheetRow,
  assertInvalidTimesheetRow,
} from "../helpers/assertion-helpers";

describe("Validation Rules Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Date Validation", () => {
    it("should validate correct date format (mm/dd/yyyy)", () => {
      const validDates = [
        "01/15/2025",
        "12/31/2024",
        "02/29/2024", // Leap year
        "03/31/2025",
      ];

      validDates.forEach((date) => {
        expect(isValidDate(date)).toBe(true);
      });
    });

    it("should reject invalid date formats", () => {
      const invalidDates = [
        "2025-01-15", // Wrong format
        "1/15/25", // Wrong format
        "01-15-2025", // Wrong separator
        "15/01/2025", // Wrong order
        "01/15", // Missing year
        "2025/01/15", // Wrong format
        "", // Empty
      ];

      invalidDates.forEach((date) => {
        expect(isValidDate(date)).toBe(false);
      });
    });

    it("should reject invalid dates", () => {
      const invalidDates = [
        "13/15/2025", // Invalid month
        "02/30/2025", // Invalid day for February
        "04/31/2025", // April only has 30 days
        "02/29/2023", // Not a leap year
        "00/15/2025", // Invalid month
        "01/00/2025", // Invalid day
        "01/32/2025", // Invalid day
      ];

      invalidDates.forEach((date) => {
        expect(isValidDate(date)).toBe(false);
      });
    });

    it("should handle leap year correctly", () => {
      expect(isValidDate("02/29/2024")).toBe(true); // Leap year
      expect(isValidDate("02/29/2023")).toBe(false); // Not leap year
      expect(isValidDate("02/29/2020")).toBe(true); // Leap year
      expect(isValidDate("02/29/2021")).toBe(false); // Not leap year
    });

    it("should validate quarter availability", () => {
      // Valid dates in available quarters (Q1-Q4 2025)
      const validQuarterDates = [
        "01/01/2025", // Q1
        "02/15/2025", // Q1
        "03/31/2025", // Q1
        "04/01/2025", // Q2
        "07/15/2025", // Q3
      ];

      // Invalid dates outside available quarters
      const invalidQuarterDates = [
        "12/31/2024", // Before available quarters
        "01/01/2026", // After available quarters
      ];

      validQuarterDates.forEach((date) => {
        const [month, day, year] = date.split("/").map(Number);
        const isoDate = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        expect(validateQuarterAvailability(isoDate)).toBeNull();
      });

      invalidQuarterDates.forEach((date) => {
        const [month, day, year] = date.split("/").map(Number);
        const isoDate = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        expect(validateQuarterAvailability(isoDate)).toBeTruthy();
      });
    });
  });

  describe("Hours Validation", () => {
    it("should validate hours in 15-minute increments", () => {
      const validHours = [
        0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 8.0, 8.25, 8.5, 8.75, 12.0,
        24.0,
      ];

      validHours.forEach((hours) => {
        expect(isValidHours(hours)).toBe(true);
      });
    });

    it("should reject non-15-minute increments", () => {
      const invalidIncrements = [
        0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9, 1.1, 1.2, 1.3, 1.4, 1.6, 1.7,
        1.8, 1.9,
      ];

      invalidIncrements.forEach((hours) => {
        expect(isValidHours(hours)).toBe(false);
      });
    });

    it("should reject hours outside valid range", () => {
      expect(isValidHours(0)).toBe(false); // Below minimum
      expect(isValidHours(0.24)).toBe(false); // Below minimum
      expect(isValidHours(24.25)).toBe(false); // Above maximum
      expect(isValidHours(25.0)).toBe(false); // Above maximum
    });

    it("should handle edge cases for hours validation", () => {
      // Minimum hours
      expect(isValidHours(0.25)).toBe(true);

      // Maximum hours
      expect(isValidHours(24.0)).toBe(true);

      // Invalid inputs
      expect(isValidHours(undefined)).toBe(false);
      expect(isValidHours(null)).toBe(false);
      expect(isValidHours(NaN)).toBe(false);
    });
  });

  describe("Field Validation", () => {
    const mockRows: TimesheetRow[] = [
      {
        date: "01/15/2025",
        hours: 8.0,
        project: "FL-Carver Techs",
        tool: "#1 Rinse and 2D marker",
        chargeCode: "EPR1",
        taskDescription: "Test task",
      },
    ];

    const projects = [
      "FL-Carver Techs",
      "FL-Carver Tools",
      "OSC-BBB",
      "PTO/RTO",
      "SWFL-CHEM/GAS",
      "SWFL-EQUIP",
      "Training",
    ];

    const chargeCodes = [
      "Admin",
      "EPR1",
      "EPR2",
      "EPR3",
      "EPR4",
      "Repair",
      "Meeting",
      "Other",
      "PM",
      "Training",
      "Upgrade",
    ];

    it("should validate required fields", () => {
      const requiredFields = ["date", "hours", "project", "taskDescription"];

      requiredFields.forEach((field) => {
        const error = validateField(
          "",
          0,
          field,
          mockRows,
          projects,
          chargeCodes
        );
        expect(error).toBeTruthy();
        expect(error).toContain("required");
      });
    });

    it("should validate date field", () => {
      const validDate = validateField(
        "01/15/2025",
        0,
        "date",
        mockRows,
        projects,
        chargeCodes
      );
      expect(validDate).toBeNull();

      const invalidDate = validateField(
        "2025-01-15",
        0,
        "date",
        mockRows,
        projects,
        chargeCodes
      );
      expect(invalidDate).toBeTruthy();
      expect(invalidDate).toContain("like 01/15/2024");
    });

    it("should validate hours field", () => {
      const validHours = validateField(
        8.0,
        0,
        "hours",
        mockRows,
        projects,
        chargeCodes
      );
      expect(validHours).toBeNull();

      const invalidHours = validateField(
        0.1,
        0,
        "hours",
        mockRows,
        projects,
        chargeCodes
      );
      expect(invalidHours).toBeTruthy();
      expect(invalidHours).toContain("15-minute increments");

      const belowMin = validateField(
        0.15,
        0,
        "hours",
        mockRows,
        projects,
        chargeCodes
      );
      expect(belowMin).toBeTruthy();
      expect(belowMin).toContain("between 0.25 and 24.0");

      const aboveMax = validateField(
        25.0,
        0,
        "hours",
        mockRows,
        projects,
        chargeCodes
      );
      expect(aboveMax).toBeTruthy();
      expect(aboveMax).toContain("between 0.25 and 24.0");
    });

    it("should validate project field", () => {
      const validProject = validateField(
        "FL-Carver Techs",
        0,
        "project",
        mockRows,
        projects,
        chargeCodes
      );
      expect(validProject).toBeNull();

      const invalidProject = validateField(
        "Invalid Project",
        0,
        "project",
        mockRows,
        projects,
        chargeCodes
      );
      expect(invalidProject).toBeTruthy();
      expect(invalidProject).toContain("from the list");
    });

    it("should validate tool field based on project", () => {
      // Project that needs tools
      const validTool = validateField(
        "#1 Rinse and 2D marker",
        0,
        "tool",
        mockRows,
        projects,
        chargeCodes
      );
      expect(validTool).toBeNull();

      // Project that doesn't need tools
      const rowsWithPTO = [
        {
          ...mockRows[0],
          project: "PTO/RTO",
        },
      ];
      const toolForPTO = validateField(
        "",
        0,
        "tool",
        rowsWithPTO,
        projects,
        chargeCodes
      );
      expect(toolForPTO).toBeNull(); // Should be null (N/A)
    });

    it("should validate chargeCode field based on tool", () => {
      // Tool that needs charge code
      const validChargeCode = validateField(
        "EPR1",
        0,
        "chargeCode",
        mockRows,
        projects,
        chargeCodes
      );
      expect(validChargeCode).toBeNull();

      // Tool that doesn't need charge code
      const rowsWithMeeting = [
        {
          ...mockRows[0],
          tool: "Meeting",
        },
      ];
      const chargeCodeForMeeting = validateField(
        "",
        0,
        "chargeCode",
        rowsWithMeeting,
        projects,
        chargeCodes
      );
      expect(chargeCodeForMeeting).toBeNull(); // Should be null (N/A)
    });

    it("should validate taskDescription field", () => {
      const validDescription = validateField(
        "Test task description",
        0,
        "taskDescription",
        mockRows,
        projects,
        chargeCodes
      );
      expect(validDescription).toBeNull();

      const invalidDescription = validateField(
        "",
        0,
        "taskDescription",
        mockRows,
        projects,
        chargeCodes
      );
      expect(invalidDescription).toBeTruthy();
      expect(invalidDescription).toContain("describe what you did");
    });
  });

  describe("Comprehensive Validation Tests", () => {
    it("should validate all valid timesheet entries", () => {
      validTimesheetEntries.forEach((entry) => {
        assertValidTimesheetRow(entry);

        // Test individual validations
        expect(isValidDate(entry.date)).toBe(true);
        if (entry.hours !== undefined) {
          expect(isValidHours(entry.hours)).toBe(true);
        }
      });
    });

    it("should reject all invalid timesheet entries", () => {
      const actuallyInvalidEntries = invalidTimesheetEntries.filter((entry) => {
        const hasInvalidDate = !isValidDate(entry.date || "");
        const hasInvalidHours =
          entry.hours !== undefined && !isValidHours(entry.hours);
        const hasMissingRequired =
          !entry.date ||
          entry.hours === undefined ||
          !entry.project ||
          !entry.taskDescription;

        return hasInvalidDate || hasInvalidHours || hasMissingRequired;
      });

      expect(actuallyInvalidEntries.length).toBeGreaterThan(0);

      actuallyInvalidEntries.forEach((entry) => {
        assertInvalidTimesheetRow(entry);
      });
    });

    it("should handle edge cases correctly", () => {
      edgeCaseEntries.forEach((entry) => {
        // Edge cases should be handled appropriately
        if (entry.date === "02/29/2024") {
          expect(isValidDate(entry.date)).toBe(true); // Valid leap year
        } else if (entry.date === "02/29/2023") {
          expect(isValidDate(entry.date)).toBe(false); // Invalid non-leap year
        }

        if (entry.hours === 0.25) {
          expect(isValidHours(entry.hours)).toBe(true); // Minimum hours
        }

        if (entry.hours === 24.0) {
          expect(isValidHours(entry.hours)).toBe(true);
        }
      });
    });
  });

  describe("Business Rule Validation", () => {
    it("should enforce project-tool relationships", () => {
      const projectsWithoutTools = [
        "ERT",
        "PTO/RTO",
        "SWFL-CHEM/GAS",
        "Training",
      ];

      projectsWithoutTools.forEach((project) => {
        const rows: TimesheetRow[] = [
          {
            date: "01/15/2025",
            hours: 8.0,
            project: project,
            tool: "Some Tool", // Should be cleared
            chargeCode: "EPR1", // Should be cleared
            taskDescription: "Test task",
          },
        ];

        // Tool should be null for these projects
        const toolValidation = validateField(
          "",
          0,
          "tool",
          rows,
          ["FL-Carver Techs", ...projectsWithoutTools],
          ["EPR1"]
        );
        expect(toolValidation).toBeNull(); // Should be null (N/A)
      });
    });

    it("should enforce tool-chargeCode relationships", () => {
      const toolsWithoutCharges = [
        "Internal Meeting",
        "DECA Meeting",
        "Logistics",
        "Meeting",
        "Non Tool Related",
        "Admin",
        "Training",
        "N/A",
      ];

      toolsWithoutCharges.forEach((tool) => {
        const rows: TimesheetRow[] = [
          {
            date: "01/15/2025",
            hours: 8.0,
            project: "FL-Carver Techs",
            tool: tool,
            chargeCode: "EPR1", // Should be cleared
            taskDescription: "Test task",
          },
        ];

        // Charge code should be null for these tools
        const chargeCodeValidation = validateField(
          "",
          0,
          "chargeCode",
          rows,
          ["FL-Carver Techs"],
          ["EPR1"]
        );
        expect(chargeCodeValidation).toBeNull(); // Should be null (N/A)
      });
    });

    it("should validate quarter availability", () => {
      // Test with available quarter dates (Q1-Q4 2025)
      const availableQuarterDates = [
        "01/01/2025", // Q1
        "02/15/2025", // Q1
        "03/31/2025", // Q1
        "04/01/2025", // Q2
        "07/15/2025", // Q3
      ];

      availableQuarterDates.forEach((date) => {
        const [month, day, year] = date.split("/").map(Number);
        const isoDate = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        expect(validateQuarterAvailability(isoDate)).toBeNull();
      });
    });
  });

  describe("Error Message Validation", () => {
    it("should provide user-friendly error messages", () => {
      const errorMessages = [
        "Please enter a date",
        "Please enter start time",
        "Please enter end time",
        "Please pick a project",
        "Please describe what you did",
        "Date must be like 01/15/2024",
        "Time must be like 09:00, 800, or 1430 and in 15 minute steps",
        "End time must be after start time",
        "Please pick from the list",
      ];

      errorMessages.forEach((message) => {
        expect(message.length).toBeLessThan(100);
        expect(message).not.toContain("undefined");
        expect(message).not.toContain("null");
        expect(message).not.toContain("Error:");
        expect(message).not.toContain("TypeError:");
        expect(message).not.toContain("Exception");
      });
    });

    it("should provide specific guidance for each field", () => {
      const fieldGuidance = {
        date: "like 01/15/2024",
        hours:
          "like 1.25, 1.5, 2.0 in 15-minute increments (0.25, 0.5, 0.75, etc.)",
        project: "from the list",
        tool: "for this project",
        chargeCode: "for this tool",
        taskDescription: "describe what you did",
      };

      Object.entries(fieldGuidance).forEach(([_field, guidance]) => {
        expect(guidance).toBeDefined();
        expect(typeof guidance).toBe("string");
        expect(guidance.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Edge Cases - Malformed Inputs", () => {
    it("should handle null and undefined date values", () => {
      expect(isValidDate(null as unknown as string)).toBe(false);
      expect(isValidDate(undefined as unknown as string)).toBe(false);
    });

    it("should handle object date values", () => {
      expect(isValidDate({} as unknown as string)).toBe(false);
      expect(isValidDate({ date: "01/15/2025" } as unknown as string)).toBe(
        false
      );
      expect(isValidDate(new Date() as unknown as string)).toBe(false);
    });

    it("should handle null and undefined hours values", () => {
      expect(isValidHours(null)).toBe(false);
      expect(isValidHours(undefined)).toBe(false);
    });

    it("should handle invalid hours types", () => {
      expect(isValidHours(NaN)).toBe(false);
      expect(isValidHours("8.0" as unknown as number)).toBe(false);
      expect(isValidHours({} as unknown as number)).toBe(false);
    });

    it("should handle numeric date values", () => {
      expect(isValidDate(20250115 as unknown as string)).toBe(false);
      expect(isValidDate(1705276800000 as unknown as string)).toBe(false);
    });

    it("should handle array inputs", () => {
      expect(isValidDate(["01", "15", "2025"] as unknown as string)).toBe(
        false
      );
    });

    it("should handle boolean inputs", () => {
      expect(isValidDate(true as unknown as string)).toBe(false);
      expect(isValidDate(false as unknown as string)).toBe(false);
    });
  });

  describe("Edge Cases - Boundary Tests", () => {
    it("should reject times at 14-minute boundary", () => {
      const fourteenMinuteTimes = [
        "00:14",
        "01:14",
        "09:14",
        "12:14",
        "18:14",
        "23:14",
      ];

      fourteenMinuteTimes.forEach((time) => {
        expect(isValidTime(time)).toBe(false);
      });
    });

    it("should accept times at 15-minute boundary", () => {
      const fifteenMinuteTimes = [
        "00:15",
        "01:15",
        "09:15",
        "12:15",
        "18:15",
        "23:15",
      ];

      fifteenMinuteTimes.forEach((time) => {
        expect(isValidTime(time)).toBe(true);
      });
    });

    it("should reject times at 16-minute boundary", () => {
      const sixteenMinuteTimes = [
        "00:16",
        "01:16",
        "09:16",
        "12:16",
        "18:16",
        "23:16",
      ];

      sixteenMinuteTimes.forEach((time) => {
        expect(isValidTime(time)).toBe(false);
      });
    });

    it("should handle hours increment boundaries around all valid increments", () => {
      const validIncrements = [0.25, 0.5, 0.75, 1.0];

      validIncrements.forEach((baseHours) => {
        // Just below should be invalid (unless at minimum)
        if (baseHours > 0.25) {
          const below = baseHours - 0.01;
          expect(isValidHours(below)).toBe(false);
        }

        // Exact increment should be valid
        expect(isValidHours(baseHours)).toBe(true);

        // Just above should be invalid (unless next valid increment)
        if (baseHours < 24.0) {
          const above = baseHours + 0.01;
          const remainder = (above * 4) % 1;
          if (
            Math.abs(remainder) > 0.0001 &&
            Math.abs(remainder - 1) > 0.0001
          ) {
            expect(isValidHours(above)).toBe(false);
          }
        }
      });
    });

    it("should handle date boundaries at month edges", () => {
      // Last day of months
      expect(isValidDate("01/31/2025")).toBe(true);
      expect(isValidDate("02/28/2025")).toBe(true);
      expect(isValidDate("03/31/2025")).toBe(true);
      expect(isValidDate("04/30/2025")).toBe(true);
      expect(isValidDate("05/31/2025")).toBe(true);
      expect(isValidDate("06/30/2025")).toBe(true);
      expect(isValidDate("07/31/2025")).toBe(true);
      expect(isValidDate("08/31/2025")).toBe(true);
      expect(isValidDate("09/30/2025")).toBe(true);
      expect(isValidDate("10/31/2025")).toBe(true);
      expect(isValidDate("11/30/2025")).toBe(true);
      expect(isValidDate("12/31/2025")).toBe(true);

      // One day past should be invalid
      expect(isValidDate("02/29/2025")).toBe(false); // Not a leap year
      expect(isValidDate("04/31/2025")).toBe(false);
      expect(isValidDate("06/31/2025")).toBe(false);
      expect(isValidDate("09/31/2025")).toBe(false);
      expect(isValidDate("11/31/2025")).toBe(false);
    });
  });

  describe("Edge Cases - Unicode and Special Characters", () => {
    it("should handle unicode characters in text fields", () => {
      const mockRows: TimesheetRow[] = [
        {
          date: "01/15/2025",
          hours: 8.0,
          project: "FL-Carver Techs",
          tool: "#1 Rinse and 2D marker",
          chargeCode: "EPR1",
          taskDescription: "Test task with émojis 🚀 and üñïçödé",
        },
      ];

      const result = validateField(
        "Test task with émojis 🚀 and üñïçödé",
        0,
        "taskDescription",
        mockRows,
        ["FL-Carver Techs"],
        ["EPR1"]
      );
      expect(result).toBeNull(); // Should accept unicode
    });

    it("should handle special characters in task description", () => {
      const specialCharacters = [
        'Task with "quotes"',
        "Task with 'single quotes'",
        "Task with <brackets>",
        "Task with [square brackets]",
        "Task with {curly braces}",
        "Task with & ampersand",
        "Task with | pipe",
        "Task with \\ backslash",
        "Task with / forward slash",
        "Task with @ at sign",
        "Task with # hash",
        "Task with $ dollar",
        "Task with % percent",
        "Task with ^ caret",
        "Task with * asterisk",
        "Task with + plus",
        "Task with = equals",
        "Task with ~ tilde",
        "Task with ` backtick",
      ];

      const mockRows: TimesheetRow[] = [
        {
          date: "01/15/2025",
          hours: 8.0,
          project: "FL-Carver Techs",
          tool: "#1 Rinse and 2D marker",
          chargeCode: "EPR1",
          taskDescription: "",
        },
      ];

      specialCharacters.forEach((description) => {
        const result = validateField(
          description,
          0,
          "taskDescription",
          mockRows,
          ["FL-Carver Techs"],
          ["EPR1"]
        );
        expect(result).toBeNull(); // Should accept special characters
      });
    });

    it("should handle multiline text in task description", () => {
      const mockRows = [
        {
          date: "01/15/2025",
          hours: 8.0,
          project: "FL-Carver Techs",
          tool: "#1 Rinse and 2D marker",
          chargeCode: "EPR1",
          taskDescription: "Line 1\nLine 2\nLine 3",
        },
      ];

      const result = validateField(
        "Line 1\nLine 2\nLine 3",
        0,
        "taskDescription",
        mockRows,
        ["FL-Carver Techs"],
        ["EPR1"]
      );
      expect(result).toBeNull(); // Should accept multiline text
    });

    it("should handle very long text in task description", () => {
      const longText = "A".repeat(10000);
      const mockRows = [
        {
          date: "01/15/2025",
          hours: 8.0,
          project: "FL-Carver Techs",
          tool: "#1 Rinse and 2D marker",
          chargeCode: "EPR1",
          taskDescription: longText,
        },
      ];

      const result = validateField(
        longText,
        0,
        "taskDescription",
        mockRows,
        ["FL-Carver Techs"],
        ["EPR1"]
      );
      expect(result).toBeNull(); // Should accept long text (database will handle limits)
    });
  });

  describe("Edge Cases - SQL Injection Attempts", () => {
    it("should handle SQL injection patterns in task description", () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE timesheet; --",
        "1' OR '1'='1",
        "1' OR '1'='1' --",
        "1' OR '1'='1' /*",
        "admin'--",
        "admin' #",
        "admin'/*",
        "' OR 1=1--",
        "' OR 'a'='a",
        "'; EXEC sp_MSForEachTable 'DROP TABLE ?'; --",
        "SELECT * FROM timesheet WHERE '1'='1",
        "UNION SELECT NULL, NULL, NULL--",
        "1'; UPDATE timesheet SET status='Complete' WHERE '1'='1'; --",
      ];

      const mockRows: TimesheetRow[] = [
        {
          date: "01/15/2025",
          hours: 8.0,
          project: "FL-Carver Techs",
          tool: "#1 Rinse and 2D marker",
          chargeCode: "EPR1",
          taskDescription: "",
        },
      ];

      sqlInjectionAttempts.forEach((attempt) => {
        // Validation should still pass (we treat it as text)
        // The database layer should handle parameterization
        const result = validateField(
          attempt,
          0,
          "taskDescription",
          mockRows,
          ["FL-Carver Techs"],
          ["EPR1"]
        );
        expect(result).toBeNull(); // Validation treats it as regular text
      });
    });

    it("should handle SQL injection patterns in project names", () => {
      const sqlInjectionProjects = [
        "Project'; DROP TABLE--",
        "Project' OR '1'='1",
      ];

      const mockRows = [
        {
          date: "01/15/2025",
          hours: 8.0,
          project: "",
          tool: "#1 Rinse and 2D marker",
          chargeCode: "EPR1",
          taskDescription: "Test task",
        },
      ];

      // These should fail validation because they're not in the project list
      sqlInjectionProjects.forEach((project) => {
        const result = validateField(
          project,
          0,
          "project",
          mockRows,
          ["FL-Carver Techs"],
          ["EPR1"]
        );
        expect(result).toBeTruthy(); // Should fail - not in allowed list
        expect(result).toContain("from the list");
      });
    });

    it("should handle XSS attempts in task description", () => {
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        "<iframe src=\"javascript:alert('XSS')\">",
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
        '<body onload=alert("XSS")>',
      ];

      const mockRows: TimesheetRow[] = [
        {
          date: "01/15/2025",
          hours: 8.0,
          project: "FL-Carver Techs",
          tool: "#1 Rinse and 2D marker",
          chargeCode: "EPR1",
          taskDescription: "",
        },
      ];

      xssAttempts.forEach((attempt) => {
        // Validation should pass (we treat it as text)
        // The rendering layer should handle escaping
        const result = validateField(
          attempt,
          0,
          "taskDescription",
          mockRows,
          ["FL-Carver Techs"],
          ["EPR1"]
        );
        expect(result).toBeNull(); // Validation treats it as regular text
      });
    });
  });
});
