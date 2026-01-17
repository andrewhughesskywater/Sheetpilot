import { ipcMain } from "electron";
import { ipcLogger } from "@sheetpilot/shared/logger";
import { isTrustedIpcSender } from "./handlers/timesheet/main-window";
import { validateInput } from "@/validation/validate-ipc-input";
import {
  getToolsForProjectSchema,
  validateProjectSchema,
  validateToolForProjectSchema,
  validateChargeCodeSchema,
} from "@/validation/ipc-schemas";
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
} from "@/models";

export function registerBusinessConfigReadHandlers(): void {
  ipcMain.handle("business-config:getAllProjects", async (event) => {
    if (!isTrustedIpcSender(event)) {
      return {
        success: false,
        error: "Could not get projects: unauthorized request",
      };
    }

    try {
      const projects = await getAllProjects();
      return { success: true, projects };
    } catch (err: unknown) {
      ipcLogger.error("Could not get all projects", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("business-config:getProjectsWithoutTools", async (event) => {
    if (!isTrustedIpcSender(event)) {
      return {
        success: false,
        error: "Could not get projects without tools: unauthorized request",
      };
    }

    try {
      const projects = await getProjectsWithoutTools();
      return { success: true, projects };
    } catch (err: unknown) {
      ipcLogger.error("Could not get projects without tools", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle(
    "business-config:getToolsForProject",
    async (event, project: string) => {
      if (!isTrustedIpcSender(event)) {
        return {
          success: false,
          error: "Could not get tools for project: unauthorized request",
        };
      }

      const validation = validateInput(
        getToolsForProjectSchema,
        { project },
        "business-config:getToolsForProject"
      );
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      try {
        const tools = await getToolsForProject(validation.data!.project);
        return { success: true, tools };
      } catch (err: unknown) {
        ipcLogger.error("Could not get tools for project", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  ipcMain.handle("business-config:getAllTools", async (event) => {
    if (!isTrustedIpcSender(event)) {
      return {
        success: false,
        error: "Could not get tools: unauthorized request",
      };
    }

    try {
      const tools = await getAllTools();
      return { success: true, tools };
    } catch (err: unknown) {
      ipcLogger.error("Could not get all tools", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("business-config:getToolsWithoutChargeCodes", async (event) => {
    if (!isTrustedIpcSender(event)) {
      return {
        success: false,
        error: "Could not get tools without charge codes: unauthorized request",
      };
    }

    try {
      const tools = await getToolsWithoutChargeCodes();
      return { success: true, tools };
    } catch (err: unknown) {
      ipcLogger.error("Could not get tools without charge codes", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("business-config:getAllChargeCodes", async (event) => {
    if (!isTrustedIpcSender(event)) {
      return {
        success: false,
        error: "Could not get charge codes: unauthorized request",
      };
    }

    try {
      const chargeCodes = await getAllChargeCodes();
      return { success: true, chargeCodes };
    } catch (err: unknown) {
      ipcLogger.error("Could not get all charge codes", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("business-config:validateProject", async (event, project) => {
    if (!isTrustedIpcSender(event)) {
      return {
        success: false,
        error: "Could not validate project: unauthorized request",
      };
    }

    const validation = validateInput(
      validateProjectSchema,
      { project },
      "business-config:validateProject"
    );
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    try {
      const isValid = await isValidProject(validation.data!.project);
      return { success: true, isValid };
    } catch (err: unknown) {
      ipcLogger.error("Could not validate project", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle(
    "business-config:validateToolForProject",
    async (event, tool: string, project: string) => {
      if (!isTrustedIpcSender(event)) {
        return {
          success: false,
          error: "Could not validate tool for project: unauthorized request",
        };
      }

      const validation = validateInput(
        validateToolForProjectSchema,
        { tool, project },
        "business-config:validateToolForProject"
      );
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      try {
        const isValid = await isValidToolForProject(
          validation.data!.tool,
          validation.data!.project
        );
        return { success: true, isValid };
      } catch (err: unknown) {
        ipcLogger.error("Could not validate tool for project", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  ipcMain.handle(
    "business-config:validateChargeCode",
    async (event, chargeCode) => {
      if (!isTrustedIpcSender(event)) {
        return {
          success: false,
          error: "Could not validate charge code: unauthorized request",
        };
      }

      const validation = validateInput(
        validateChargeCodeSchema,
        { chargeCode },
        "business-config:validateChargeCode"
      );
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      try {
        const isValid = await isValidChargeCode(validation.data!.chargeCode);
        return { success: true, isValid };
      } catch (err: unknown) {
        ipcLogger.error("Could not validate charge code", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );
}
