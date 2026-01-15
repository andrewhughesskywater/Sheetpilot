/**
 * @fileoverview Tests for Weekly Summary Utility Functions
 */

import { describe, it, expect } from "vitest";
import {
  getWeekBounds,
  getWeekKey,
  getAllWeeksWithData,
  calculateWeekSummary,
  formatWeekRange,
  getDayName,
  formatDateShort,
  getWeekDays,
} from "@/utils/weekSummary";

interface TimesheetEntry {
  id: number;
  date: string;
  hours: number | null;
  project: string;
  tool?: string;
  detail_charge_code?: string;
  task_description: string;
  status?: string;
  submitted_at?: string;
}

describe("weekSummary utilities", () => {
  describe("getWeekBounds", () => {
    it("should return correct week bounds for a Sunday", () => {
      const date = new Date("2026-01-11T00:00:00"); // Sunday
      const { sunday, saturday } = getWeekBounds(date);

      expect(sunday.getDay()).toBe(0); // Sunday
      expect(sunday.toISOString().split("T")[0]).toBe("2026-01-11");
      expect(saturday.getDay()).toBe(6); // Saturday
      expect(saturday.toISOString().split("T")[0]).toBe("2026-01-17");
    });

    it("should return correct week bounds for a Wednesday", () => {
      const date = new Date("2026-01-14T00:00:00"); // Wednesday
      const { sunday, saturday } = getWeekBounds(date);

      expect(sunday.getDay()).toBe(0); // Sunday
      expect(sunday.toISOString().split("T")[0]).toBe("2026-01-11");
      expect(saturday.getDay()).toBe(6); // Saturday
      expect(saturday.toISOString().split("T")[0]).toBe("2026-01-17");
    });

    it("should return correct week bounds for a Saturday", () => {
      const date = new Date("2026-01-17T00:00:00"); // Saturday
      const { sunday, saturday } = getWeekBounds(date);

      expect(sunday.getDay()).toBe(0); // Sunday
      expect(sunday.toISOString().split("T")[0]).toBe("2026-01-11");
      expect(saturday.getDay()).toBe(6); // Saturday
      expect(saturday.toISOString().split("T")[0]).toBe("2026-01-17");
    });

    it("should handle week spanning month boundary", () => {
      const date = new Date("2026-01-30T00:00:00"); // Thursday
      const { sunday, saturday } = getWeekBounds(date);

      expect(sunday.getDay()).toBe(0); // Sunday
      expect(sunday.toISOString().split("T")[0]).toBe("2026-01-25");
      expect(saturday.getDay()).toBe(6); // Saturday
      expect(saturday.toISOString().split("T")[0]).toBe("2026-01-31");
    });
  });

  describe("getWeekKey", () => {
    it("should return correct week key for a Sunday date", () => {
      const sunday = new Date("2026-01-11T00:00:00");
      const weekKey = getWeekKey(sunday);
      expect(weekKey).toBe("2026-01-11");
    });

    it("should pad month and day with zeros", () => {
      const sunday = new Date("2026-01-05T00:00:00");
      const weekKey = getWeekKey(sunday);
      expect(weekKey).toBe("2026-01-05");
    });
  });

  describe("getAllWeeksWithData", () => {
    it("should return empty array for empty entries", () => {
      const entries: TimesheetEntry[] = [];
      const weeks = getAllWeeksWithData(entries);
      expect(weeks).toEqual([]);
    });

    it("should return empty array for null/undefined entries", () => {
      expect(getAllWeeksWithData(null as unknown as TimesheetEntry[])).toEqual(
        []
      );
      expect(
        getAllWeeksWithData(undefined as unknown as TimesheetEntry[])
      ).toEqual([]);
    });

    it("should filter out entries without Complete status", () => {
      const entries: TimesheetEntry[] = [
        {
          id: 1,
          date: "2026-01-11",
          hours: 8,
          project: "Project A",
          task_description: "Task 1",
          status: "Complete",
        },
        {
          id: 2,
          date: "2026-01-12",
          hours: 8,
          project: "Project B",
          task_description: "Task 2",
          status: "Pending",
        },
        {
          id: 3,
          date: "2026-01-13",
          hours: 8,
          project: "Project C",
          task_description: "Task 3",
          // No status
        },
      ];
      const weeks = getAllWeeksWithData(entries);
      expect(weeks).toEqual(["2026-01-11"]); // Only the Complete entry
    });

    it("should handle MM/DD/YYYY date format", () => {
      const entries: TimesheetEntry[] = [
        {
          id: 1,
          date: "01/11/2026",
          hours: 8,
          project: "Project A",
          task_description: "Task 1",
          status: "Complete",
        },
        {
          id: 2,
          date: "01/18/2026",
          hours: 8,
          project: "Project B",
          task_description: "Task 2",
          status: "Complete",
        },
      ];
      const weeks = getAllWeeksWithData(entries);
      expect(weeks).toEqual(["2026-01-11", "2026-01-18"]);
    });

    it("should return sorted week keys", () => {
      const entries: TimesheetEntry[] = [
        {
          id: 1,
          date: "2026-01-25",
          hours: 8,
          project: "Project A",
          task_description: "Task 1",
          status: "Complete",
        },
        {
          id: 2,
          date: "2026-01-11",
          hours: 8,
          project: "Project B",
          task_description: "Task 2",
          status: "Complete",
        },
        {
          id: 3,
          date: "2026-01-18",
          hours: 8,
          project: "Project C",
          task_description: "Task 3",
          status: "Complete",
        },
      ];
      const weeks = getAllWeeksWithData(entries);
      expect(weeks).toEqual(["2026-01-11", "2026-01-18", "2026-01-25"]);
    });

    it("should group entries from same week into single week key", () => {
      const entries: TimesheetEntry[] = [
        {
          id: 1,
          date: "2026-01-11", // Sunday
          hours: 8,
          project: "Project A",
          task_description: "Task 1",
          status: "Complete",
        },
        {
          id: 2,
          date: "2026-01-12", // Monday (same week)
          hours: 8,
          project: "Project B",
          task_description: "Task 2",
          status: "Complete",
        },
        {
          id: 3,
          date: "2026-01-17", // Saturday (same week)
          hours: 8,
          project: "Project C",
          task_description: "Task 3",
          status: "Complete",
        },
      ];
      const weeks = getAllWeeksWithData(entries);
      expect(weeks).toEqual(["2026-01-11"]); // All in same week
    });

    it("should skip entries with invalid dates", () => {
      const entries: TimesheetEntry[] = [
        {
          id: 1,
          date: "2026-01-11",
          hours: 8,
          project: "Project A",
          task_description: "Task 1",
          status: "Complete",
        },
        {
          id: 2,
          date: "invalid-date",
          hours: 8,
          project: "Project B",
          task_description: "Task 2",
          status: "Complete",
        },
      ];
      const weeks = getAllWeeksWithData(entries);
      expect(weeks).toEqual(["2026-01-11"]); // Only valid date
    });
  });

  describe("calculateWeekSummary", () => {
    it("should return empty array for empty entries", () => {
      const entries: TimesheetEntry[] = [];
      const weekStart = new Date("2026-01-11T00:00:00");
      const summary = calculateWeekSummary(entries, weekStart);
      expect(summary).toEqual([]);
    });

    it("should filter entries to only Complete status", () => {
      const entries: TimesheetEntry[] = [
        {
          id: 1,
          date: "2026-01-11",
          hours: 8,
          project: "Project A",
          task_description: "Task 1",
          status: "Complete",
        },
        {
          id: 2,
          date: "2026-01-12",
          hours: 8,
          project: "Project B",
          task_description: "Task 2",
          status: "Pending",
        },
      ];
      const weekStart = new Date("2026-01-11T00:00:00");
      const summary = calculateWeekSummary(entries, weekStart);
      expect(summary).toHaveLength(1);
      expect(summary[0].project).toBe("Project A");
    });

    it("should filter entries to only those in the specified week", () => {
      const entries: TimesheetEntry[] = [
        {
          id: 1,
          date: "2026-01-11", // Sunday of week
          hours: 8,
          project: "Project A",
          task_description: "Task 1",
          status: "Complete",
        },
        {
          id: 2,
          date: "2026-01-18", // Next week
          hours: 8,
          project: "Project B",
          task_description: "Task 2",
          status: "Complete",
        },
      ];
      const weekStart = new Date("2026-01-11T00:00:00");
      const summary = calculateWeekSummary(entries, weekStart);
      expect(summary).toHaveLength(1);
      expect(summary[0].project).toBe("Project A");
    });

    it("should group hours by project and day", () => {
      const entries: TimesheetEntry[] = [
        {
          id: 1,
          date: "2026-01-11", // Sunday (day 0)
          hours: 4,
          project: "Project A",
          task_description: "Task 1",
          status: "Complete",
        },
        {
          id: 2,
          date: "2026-01-11", // Sunday (day 0) - same project, same day
          hours: 4,
          project: "Project A",
          task_description: "Task 2",
          status: "Complete",
        },
        {
          id: 3,
          date: "2026-01-12", // Monday (day 1)
          hours: 8,
          project: "Project A",
          task_description: "Task 3",
          status: "Complete",
        },
        {
          id: 4,
          date: "2026-01-11", // Sunday (day 0)
          hours: 6,
          project: "Project B",
          task_description: "Task 4",
          status: "Complete",
        },
      ];
      const weekStart = new Date("2026-01-11T00:00:00");
      const summary = calculateWeekSummary(entries, weekStart);

      expect(summary).toHaveLength(2);

      // Project A: 8 hours Sunday, 8 hours Monday
      const projectA = summary.find((s) => s.project === "Project A");
      expect(projectA).toBeDefined();
      expect(projectA?.days[0]).toBe(8); // Sunday
      expect(projectA?.days[1]).toBe(8); // Monday
      expect(projectA?.total).toBe(16);

      // Project B: 6 hours Sunday
      const projectB = summary.find((s) => s.project === "Project B");
      expect(projectB).toBeDefined();
      expect(projectB?.days[0]).toBe(6); // Sunday
      expect(projectB?.total).toBe(6);
    });

    it("should handle null hours as zero", () => {
      const entries: TimesheetEntry[] = [
        {
          id: 1,
          date: "2026-01-11",
          hours: null,
          project: "Project A",
          task_description: "Task 1",
          status: "Complete",
        },
      ];
      const weekStart = new Date("2026-01-11T00:00:00");
      const summary = calculateWeekSummary(entries, weekStart);
      expect(summary[0].days[0]).toBe(0);
      expect(summary[0].total).toBe(0);
    });

    it("should sort projects alphabetically", () => {
      const entries: TimesheetEntry[] = [
        {
          id: 1,
          date: "2026-01-11",
          hours: 8,
          project: "Zebra Project",
          task_description: "Task 1",
          status: "Complete",
        },
        {
          id: 2,
          date: "2026-01-12",
          hours: 8,
          project: "Alpha Project",
          task_description: "Task 2",
          status: "Complete",
        },
        {
          id: 3,
          date: "2026-01-13",
          hours: 8,
          project: "Beta Project",
          task_description: "Task 3",
          status: "Complete",
        },
      ];
      const weekStart = new Date("2026-01-11T00:00:00");
      const summary = calculateWeekSummary(entries, weekStart);

      expect(summary).toHaveLength(3);
      expect(summary[0].project).toBe("Alpha Project");
      expect(summary[1].project).toBe("Beta Project");
      expect(summary[2].project).toBe("Zebra Project");
    });

    it("should handle MM/DD/YYYY date format", () => {
      const entries: TimesheetEntry[] = [
        {
          id: 1,
          date: "01/11/2026",
          hours: 8,
          project: "Project A",
          task_description: "Task 1",
          status: "Complete",
        },
      ];
      const weekStart = new Date("2026-01-11T00:00:00");
      const summary = calculateWeekSummary(entries, weekStart);
      expect(summary).toHaveLength(1);
      expect(summary[0].project).toBe("Project A");
    });
  });

  describe("formatWeekRange", () => {
    it("should format same month and year correctly", () => {
      const sunday = new Date("2026-01-11T00:00:00");
      const saturday = new Date("2026-01-17T00:00:00");
      const formatted = formatWeekRange(sunday, saturday);
      expect(formatted).toBe("Jan 11 - 17, 2026");
    });

    it("should format different months same year correctly", () => {
      const sunday = new Date("2026-01-25T00:00:00");
      const saturday = new Date("2026-02-01T00:00:00");
      const formatted = formatWeekRange(sunday, saturday);
      expect(formatted).toBe("Jan 25 - Feb 1, 2026");
    });

    it("should format different years correctly", () => {
      const sunday = new Date("2025-12-28T00:00:00");
      const saturday = new Date("2026-01-03T00:00:00");
      const formatted = formatWeekRange(sunday, saturday);
      expect(formatted).toBe("Dec 28, 2025 - Jan 3, 2026");
    });
  });

  describe("getDayName", () => {
    it("should return correct day names", () => {
      expect(getDayName(new Date("2026-01-11T00:00:00"))).toBe("Sun"); // Sunday
      expect(getDayName(new Date("2026-01-12T00:00:00"))).toBe("Mon"); // Monday
      expect(getDayName(new Date("2026-01-13T00:00:00"))).toBe("Tue"); // Tuesday
      expect(getDayName(new Date("2026-01-14T00:00:00"))).toBe("Wed"); // Wednesday
      expect(getDayName(new Date("2026-01-15T00:00:00"))).toBe("Thu"); // Thursday
      expect(getDayName(new Date("2026-01-16T00:00:00"))).toBe("Fri"); // Friday
      expect(getDayName(new Date("2026-01-17T00:00:00"))).toBe("Sat"); // Saturday
    });
  });

  describe("formatDateShort", () => {
    it("should format dates correctly", () => {
      expect(formatDateShort(new Date("2026-01-05T00:00:00"))).toBe("1/5");
      expect(formatDateShort(new Date("2026-01-11T00:00:00"))).toBe("1/11");
      expect(formatDateShort(new Date("2026-12-31T00:00:00"))).toBe("12/31");
    });
  });

  describe("getWeekDays", () => {
    it("should return all 7 days starting from Sunday", () => {
      const weekStart = new Date("2026-01-11T00:00:00"); // Sunday
      const days = getWeekDays(weekStart);

      expect(days).toHaveLength(7);
      expect(days[0].getDay()).toBe(0); // Sunday
      expect(days[1].getDay()).toBe(1); // Monday
      expect(days[2].getDay()).toBe(2); // Tuesday
      expect(days[3].getDay()).toBe(3); // Wednesday
      expect(days[4].getDay()).toBe(4); // Thursday
      expect(days[5].getDay()).toBe(5); // Friday
      expect(days[6].getDay()).toBe(6); // Saturday
    });

    it("should return correct dates for the week", () => {
      const weekStart = new Date("2026-01-11T00:00:00"); // Sunday
      const days = getWeekDays(weekStart);

      expect(days[0].toISOString().split("T")[0]).toBe("2026-01-11"); // Sunday
      expect(days[6].toISOString().split("T")[0]).toBe("2026-01-17"); // Saturday
    });
  });
});
