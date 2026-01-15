/**
 * @fileoverview Test Data Builders
 *
 * Builder pattern for creating test data with fluent API.
 * Provides type-safe construction of test objects with sensible defaults.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { TimesheetRow } from "../../src/logic/timesheet-validation";
import type { DbTimesheetEntry } from "@sheetpilot/shared";

/**
 * Builder for TimesheetRow test data
 */
export class TimesheetRowBuilder {
  private data: TimesheetRow = {
    date: "01/15/2025",
    hours: 8.0,
    project: "FL-Carver Techs",
    tool: "#1 Rinse and 2D marker",
    chargeCode: "EPR1",
    taskDescription: "Test task description",
  };

  static create(): TimesheetRowBuilder {
    return new TimesheetRowBuilder();
  }

  withId(id: number): TimesheetRowBuilder {
    this.data.id = id;
    return this;
  }

  withDate(date: string): TimesheetRowBuilder {
    this.data.date = date;
    return this;
  }

  withHours(hours: number): TimesheetRowBuilder {
    this.data.hours = hours;
    return this;
  }

  withProject(project: string): TimesheetRowBuilder {
    this.data.project = project;
    return this;
  }

  withTool(tool: string | null): TimesheetRowBuilder {
    this.data.tool = tool;
    return this;
  }

  withChargeCode(chargeCode: string | null): TimesheetRowBuilder {
    this.data.chargeCode = chargeCode;
    return this;
  }

  withTaskDescription(taskDescription: string): TimesheetRowBuilder {
    this.data.taskDescription = taskDescription;
    return this;
  }

  // Convenience methods for common scenarios
  asPTOEntry(): TimesheetRowBuilder {
    return this.withProject("PTO/RTO")
      .withTool(null)
      .withChargeCode(null)
      .withTaskDescription("Personal time off");
  }

  asTrainingEntry(): TimesheetRowBuilder {
    return this.withProject("Training")
      .withTool(null)
      .withChargeCode(null)
      .withTaskDescription("Safety training");
  }

  asMeetingEntry(): TimesheetRowBuilder {
    return this.withProject("FL-Carver Techs")
      .withTool("Meeting")
      .withChargeCode(null)
      .withTaskDescription("Team meeting");
  }

  asEquipmentEntry(): TimesheetRowBuilder {
    return this.withProject("FL-Carver Techs")
      .withTool("#1 Rinse and 2D marker")
      .withChargeCode("EPR1")
      .withTaskDescription("Equipment maintenance");
  }

  // Invalid data scenarios
  withMissingDate(): TimesheetRowBuilder {
    this.data.date = "";
    return this;
  }

  withMissingHours(): TimesheetRowBuilder {
    this.data.hours = undefined;
    return this;
  }

  withMissingProject(): TimesheetRowBuilder {
    this.data.project = "";
    return this;
  }

  withMissingTaskDescription(): TimesheetRowBuilder {
    this.data.taskDescription = "";
    return this;
  }

  withInvalidDate(): TimesheetRowBuilder {
    this.data.date = "2025-01-15"; // Wrong format
    return this;
  }

  withInvalidHours(): TimesheetRowBuilder {
    this.data.hours = 0.1; // Not 15-minute increment
    return this;
  }

  withInvalidProject(): TimesheetRowBuilder {
    this.data.project = "Invalid Project";
    return this;
  }

  withInvalidTool(): TimesheetRowBuilder {
    this.data.tool = "Invalid Tool";
    return this;
  }

  withInvalidChargeCode(): TimesheetRowBuilder {
    this.data.chargeCode = "Invalid Code";
    return this;
  }

  build(): TimesheetRow {
    return { ...this.data };
  }
}

/**
 * Builder for DbTimesheetEntry test data
 */
export class DbTimesheetEntryBuilder {
  private data: DbTimesheetEntry = {
    id: 1,
    date: "2025-01-15",
    hours: 8.0,
    project: "FL-Carver Techs",
    tool: "#1 Rinse and 2D marker",
    detail_charge_code: "EPR1",
    task_description: "Test task description",
    status: null,
    submitted_at: null,
  };

  static create(): DbTimesheetEntryBuilder {
    return new DbTimesheetEntryBuilder();
  }

  withId(id: number): DbTimesheetEntryBuilder {
    this.data.id = id;
    return this;
  }

  withDate(date: string): DbTimesheetEntryBuilder {
    this.data.date = date;
    return this;
  }

  withHours(hours: number): DbTimesheetEntryBuilder {
    this.data.hours = hours;
    return this;
  }

  withProject(project: string): DbTimesheetEntryBuilder {
    this.data.project = project;
    return this;
  }

  withTool(tool: string | null): DbTimesheetEntryBuilder {
    this.data.tool = tool;
    return this;
  }

  withDetailChargeCode(chargeCode: string | null): DbTimesheetEntryBuilder {
    this.data.detail_charge_code = chargeCode;
    return this;
  }

  withTaskDescription(taskDescription: string): DbTimesheetEntryBuilder {
    this.data.task_description = taskDescription;
    return this;
  }

  withStatus(status: string | null): DbTimesheetEntryBuilder {
    this.data.status = status;
    return this;
  }

  withSubmittedAt(submittedAt: string | null): DbTimesheetEntryBuilder {
    this.data.submitted_at = submittedAt;
    return this;
  }

  // Convenience methods
  asPending(): DbTimesheetEntryBuilder {
    this.data.status = null;
    this.data.submitted_at = null;
    return this;
  }

  asComplete(): DbTimesheetEntryBuilder {
    return this.withStatus("Complete").withSubmittedAt(
      new Date().toISOString()
    );
  }

  asPTOEntry(): DbTimesheetEntryBuilder {
    return this.withProject("PTO/RTO")
      .withTool(null)
      .withDetailChargeCode(null)
      .withTaskDescription("Personal time off");
  }

  asTrainingEntry(): DbTimesheetEntryBuilder {
    return this.withProject("Training")
      .withTool(null)
      .withDetailChargeCode(null)
      .withTaskDescription("Safety training");
  }

  asMeetingEntry(): DbTimesheetEntryBuilder {
    return this.withProject("FL-Carver Techs")
      .withTool("Meeting")
      .withDetailChargeCode(null)
      .withTaskDescription("Team meeting");
  }

  asEquipmentEntry(): DbTimesheetEntryBuilder {
    return this.withProject("FL-Carver Techs")
      .withTool("#1 Rinse and 2D marker")
      .withDetailChargeCode("EPR1")
      .withTaskDescription("Equipment maintenance");
  }

  build(): DbTimesheetEntry {
    return { ...this.data };
  }
}

/**
 * Builder for IPC payload test data
 */
export class IPCPayloadBuilder {
  private data: Record<string, unknown> = {
    date: "01/15/2025",
    hours: 8.0,
    project: "FL-Carver Techs",
    tool: "#1 Rinse and 2D marker",
    chargeCode: "EPR1",
    taskDescription: "Test task description",
  };

  static create(): IPCPayloadBuilder {
    return new IPCPayloadBuilder();
  }

  withId(id: number): IPCPayloadBuilder {
    this.data["id"] = id;
    return this;
  }

  withDate(date: string): IPCPayloadBuilder {
    this.data["date"] = date;
    return this;
  }

  withHours(hours: number): IPCPayloadBuilder {
    this.data["hours"] = hours;
    return this;
  }

  withProject(project: string): IPCPayloadBuilder {
    this.data["project"] = project;
    return this;
  }

  withTool(tool: string | null): IPCPayloadBuilder {
    this.data["tool"] = tool;
    return this;
  }

  withChargeCode(chargeCode: string | null): IPCPayloadBuilder {
    this.data["chargeCode"] = chargeCode;
    return this;
  }

  withTaskDescription(taskDescription: string): IPCPayloadBuilder {
    this.data["taskDescription"] = taskDescription;
    return this;
  }

  // Methods for creating invalid payloads
  withMissingDate(): IPCPayloadBuilder {
    delete this.data["date"];
    return this;
  }

  withMissingProject(): IPCPayloadBuilder {
    delete this.data["project"];
    return this;
  }

  withMissingTaskDescription(): IPCPayloadBuilder {
    delete this.data["taskDescription"];
    return this;
  }

  // Convenience methods
  asSaveDraftPayload(): IPCPayloadBuilder {
    return this; // Already in correct format
  }

  asLoadDraftPayload(): IPCPayloadBuilder {
    return this; // Already in correct format
  }

  asInvalidPayload(): IPCPayloadBuilder {
    this.data["date"] = "";
    this.data["project"] = "";
    this.data["taskDescription"] = "";
    return this;
  }

  build(): Record<string, unknown> {
    return { ...this.data };
  }
}

/**
 * Utility functions for test data creation
 */
export class TestDataUtils {
  /**
   * Convert TimesheetRow to DbTimesheetEntry
   */
  static timesheetRowToDbEntry(row: TimesheetRow): DbTimesheetEntry {
    const entry: DbTimesheetEntry = {
      id: row.id || 1,
      date: row.date
        ? (() => {
            const parts = row.date.split("/").map(Number);
            const month = parts[0] ?? 1;
            const day = parts[1] ?? 1;
            const year = parts[2] ?? 2025;
            return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          })()
        : "2025-01-15",
      hours: row.hours ?? 8.0,
      project: row.project || "FL-Carver Techs",
      task_description: row.taskDescription || "Test task",
    };

    if (row.tool) entry.tool = row.tool;
    if (row.chargeCode) entry.detail_charge_code = row.chargeCode;

    return entry;
  }

  /**
   * Convert DbTimesheetEntry to TimesheetRow
   */
  static dbEntryToTimesheetRow(entry: DbTimesheetEntry): TimesheetRow {
    const parts = entry.date.split("-");
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    const usDate = `${month}/${day}/${year}`;

    return {
      id: entry.id,
      date: usDate,
      hours: entry.hours ?? undefined,
      project: entry.project,
      tool: entry.tool ?? null,
      chargeCode: entry.detail_charge_code ?? null,
      taskDescription: entry.task_description,
    };
  }

  /**
   * Create multiple entries with sequential IDs
   */
  static createMultipleEntries(
    count: number,
    baseBuilder: TimesheetRowBuilder
  ): TimesheetRow[] {
    return Array.from({ length: count }, (_, index) =>
      baseBuilder.withId(index + 1).build()
    );
  }

  /**
   * Create entries for all projects
   */
  static createAllProjectEntries(): TimesheetRow[] {
    const projects = [
      "FL-Carver Techs",
      "FL-Carver Tools",
      "OSC-BBB",
      "PTO/RTO",
      "SWFL-CHEM/GAS",
      "SWFL-EQUIP",
      "Training",
    ];

    return projects.map((project, index) =>
      TimesheetRowBuilder.create()
        .withId(index + 1)
        .withProject(project)
        .build()
    );
  }
}
