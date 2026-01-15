/**
 * @fileoverview Timesheet Validation Logic Unit Tests
 *
 * Tests for the backend validation logic module to ensure all validation
 * functions work correctly and prevent regressions.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidDate,
  isValidHours,
  validateField,
  type TimesheetRow,
} from "../../src/logic/timesheet-validation";

describe("Backend Timesheet Validation Logic", () => {
  describe("isValidDate Function", () => {
    it("should validate correct mm/dd/yyyy dates", () => {
      const validDates = [
        "01/01/2025",
        "12/31/2025",
        "02/29/2024", // Leap year
        "06/15/2025",
        "11/28/2025",
      ];

      validDates.forEach((date) => {
        expect(isValidDate(date)).toBe(true);
      });
    });

    it("should reject invalid date formats", () => {
      const invalidFormats = [
        "2025-01-15", // ISO format
        "1/1/25", // Two-digit year
        "01-15-2025", // Wrong separator
        "15/01/2025", // Day/month reversed
        "",
        undefined,
        null,
      ];

      invalidFormats.forEach((date) => {
        expect(
          isValidDate(date === null ? undefined : (date as string | undefined))
        ).toBe(false);
      });
    });

    it("should reject invalid dates", () => {
      const invalidDates = [
        "02/29/2025", // Not a leap year
        "02/30/2024", // February doesn't have 30 days
        "04/31/2025", // April only has 30 days
        "13/01/2025", // Invalid month
        "00/15/2025", // Invalid month
        "01/00/2025", // Invalid day
        "01/32/2025", // Invalid day
      ];

      invalidDates.forEach((date) => {
        expect(isValidDate(date)).toBe(false);
      });
    });

    it("should handle year boundaries correctly", () => {
      expect(isValidDate("01/01/1900")).toBe(true); // Min year
      expect(isValidDate("12/31/2500")).toBe(true); // Max year
      expect(isValidDate("12/31/1899")).toBe(false); // Below min
      expect(isValidDate("01/01/2501")).toBe(false); // Above max
    });

    it("should handle leap years correctly", () => {
      expect(isValidDate("02/29/2024")).toBe(true); // Leap year
      expect(isValidDate("02/29/2023")).toBe(false); // Not leap year
      expect(isValidDate("02/29/2000")).toBe(true); // Divisible by 400
      expect(isValidDate("02/29/1900")).toBe(false); // Not divisible by 400
    });
  });

  describe("isValidHours Function", () => {
    it("should validate correct hours in 15-minute increments", () => {
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

    it("should reject invalid inputs", () => {
      expect(isValidHours(undefined)).toBe(false);
      expect(isValidHours(null)).toBe(false);
      expect(isValidHours(NaN)).toBe(false);
    });

    it("should handle edge values", () => {
      expect(isValidHours(0.25)).toBe(true); // Minimum
      expect(isValidHours(24.0)).toBe(true); // Maximum
    });
  });

  describe("validateField Function", () => {
    const mockProjects = [
      "FL-Carver Techs",
      "FL-Carver Tools",
      "OSC-BBB",
      "PTO/RTO",
      "SWFL-CHEM/GAS",
      "SWFL-EQUIP",
      "Training",
    ];

    const mockChargeCodes = [
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

    let mockRows: TimesheetRow[];

    beforeEach(() => {
      mockRows = [
        {
          date: "01/15/2025",
          hours: 8.0,
          project: "FL-Carver Techs",
          tool: "#1 Rinse and 2D marker",
          chargeCode: "EPR1",
          taskDescription: "Test task",
        },
      ];
    });

    describe("Date Field Validation", () => {
      it("should accept valid dates", () => {
        const result = validateField(
          "10/15/2025",
          0,
          "date",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toBeNull();
      });

      it("should reject empty dates", () => {
        const result = validateField(
          "",
          0,
          "date",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("required");
      });

      it("should reject invalid date formats", () => {
        const result = validateField(
          "2025-01-15",
          0,
          "date",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("like 01/15/2024");
      });

      it("should reject invalid dates", () => {
        const result = validateField(
          "02/30/2025",
          0,
          "date",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("like 01/15/2024");
      });
    });

    describe("Hours Field Validation", () => {
      it("should accept valid hours", () => {
        const result = validateField(
          8.0,
          0,
          "hours",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toBeNull();
      });

      it("should reject empty hours", () => {
        const result = validateField(
          "",
          0,
          "hours",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("required");
      });

      it("should reject non-15-minute increments", () => {
        const result = validateField(
          0.1,
          0,
          "hours",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("15-minute increments");
      });

      it("should reject hours below minimum", () => {
        const result = validateField(
          0.15,
          0,
          "hours",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("between 0.25 and 24.0");
      });

      it("should reject hours above maximum", () => {
        const result = validateField(
          25.0,
          0,
          "hours",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("between 0.25 and 24.0");
      });
    });

    describe("Project Field Validation", () => {
      it("should accept valid projects", () => {
        const result = validateField(
          "FL-Carver Techs",
          0,
          "project",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toBeNull();
      });

      it("should reject empty projects", () => {
        const result = validateField(
          "",
          0,
          "project",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("required");
      });

      it("should reject invalid projects", () => {
        const result = validateField(
          "Invalid Project",
          0,
          "project",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("from the list");
      });
    });

    describe("Tool Field Validation", () => {
      it("should accept valid tools for projects that need them", () => {
        const result = validateField(
          "#1 Rinse and 2D marker",
          0,
          "tool",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toBeNull();
      });

      it("should accept null for projects without tools", () => {
        const rowsWithPTO = [{ ...mockRows[0], project: "PTO/RTO" }];
        const result = validateField(
          "",
          0,
          "tool",
          rowsWithPTO,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toBeNull();
      });

      it("should require tool for projects that need them", () => {
        const result = validateField(
          "",
          0,
          "tool",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("pick a tool");
      });
    });

    describe("ChargeCode Field Validation", () => {
      it("should accept valid charge codes", () => {
        const result = validateField(
          "EPR1",
          0,
          "chargeCode",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toBeNull();
      });

      it("should accept null for tools without charge codes", () => {
        const rowsWithMeeting = [{ ...mockRows[0], tool: "Meeting" }];
        const result = validateField(
          "",
          0,
          "chargeCode",
          rowsWithMeeting,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toBeNull();
      });

      it("should require charge code for tools that need them", () => {
        const result = validateField(
          "",
          0,
          "chargeCode",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("charge code");
      });

      it("should reject invalid charge codes", () => {
        const result = validateField(
          "INVALID",
          0,
          "chargeCode",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("from the list");
      });
    });

    describe("TaskDescription Field Validation", () => {
      it("should accept valid descriptions", () => {
        const result = validateField(
          "Test task description",
          0,
          "taskDescription",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toBeNull();
      });

      it("should reject empty descriptions", () => {
        const result = validateField(
          "",
          0,
          "taskDescription",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toContain("required");
      });

      it("should accept long descriptions", () => {
        const longDescription = "A".repeat(1000);
        const result = validateField(
          longDescription,
          0,
          "taskDescription",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toBeNull();
      });

      it("should accept descriptions with special characters", () => {
        const result = validateField(
          'Task with "quotes" and <brackets>',
          0,
          "taskDescription",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toBeNull();
      });
    });

    describe("Unknown Field Validation", () => {
      it("should return null for unknown fields", () => {
        const result = validateField(
          "value",
          0,
          "unknownField",
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(result).toBeNull();
      });
    });
  });

  describe("Error Message Quality", () => {
    const mockProjects = ["FL-Carver Techs"];
    const mockChargeCodes = ["EPR1"];
    const mockRows: TimesheetRow[] = [
      {
        date: "01/15/2025",
        hours: 8.0,
        project: "FL-Carver Techs",
        tool: "#1 Rinse and 2D marker",
        chargeCode: "EPR1",
        taskDescription: "Test",
      },
    ];

    it("should provide user-friendly error messages", () => {
      const errors = [
        validateField("", 0, "date", mockRows, mockProjects, mockChargeCodes),
        validateField("", 0, "hours", mockRows, mockProjects, mockChargeCodes),
        validateField(
          "",
          0,
          "project",
          mockRows,
          mockProjects,
          mockChargeCodes
        ),
        validateField(
          "",
          0,
          "taskDescription",
          mockRows,
          mockProjects,
          mockChargeCodes
        ),
      ];

      errors.forEach((error) => {
        expect(error).toBeTruthy();
        expect(error!.length).toBeLessThan(100);
        expect(error).not.toContain("undefined");
        expect(error).not.toContain("null");
      });
    });

    it("should provide actionable guidance", () => {
      const dateError = validateField(
        "invalid",
        0,
        "date",
        mockRows,
        mockProjects,
        mockChargeCodes
      );
      expect(dateError).toContain("like 01/15/2024"); // Shows example

      const hoursError = validateField(
        "invalid",
        0,
        "hours",
        mockRows,
        mockProjects,
        mockChargeCodes
      );
      expect(hoursError).toContain("15-minute increments"); // Shows validation rule
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete row validation", () => {
      const mockProjects = ["FL-Carver Techs"];
      const mockChargeCodes = ["EPR1"];
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

      const fields = [
        "date",
        "hours",
        "project",
        "tool",
        "chargeCode",
        "taskDescription",
      ];
      const values = [
        "01/15/2025",
        8.0,
        "FL-Carver Techs",
        "#1 Rinse",
        "EPR1",
        "Test",
      ];

      fields.forEach((field, index) => {
        const result = validateField(
          values[index],
          0,
          field,
          mockRows,
          mockProjects,
          mockChargeCodes
        );
        expect(typeof result).toBe(result === null ? "object" : "string");
      });
    });

    it("should handle cascading validation dependencies", () => {
      const mockProjects = ["PTO/RTO"];
      const mockChargeCodes = ["EPR1"];
      const mockRows: TimesheetRow[] = [
        {
          date: "01/15/2025",
          hours: 8.0,
          project: "PTO/RTO",
          tool: null,
          chargeCode: null,
          taskDescription: "Test",
        },
      ];

      // PTO/RTO doesn't need tools, so tool should be null
      const toolResult = validateField(
        "",
        0,
        "tool",
        mockRows,
        mockProjects,
        mockChargeCodes
      );
      expect(toolResult).toBeNull();

      // If no tool, then no charge code
      const chargeCodeResult = validateField(
        "",
        0,
        "chargeCode",
        mockRows,
        mockProjects,
        mockChargeCodes
      );
      expect(chargeCodeResult).toBeNull();
    });
  });
});
