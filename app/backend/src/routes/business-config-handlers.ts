/**
 * @fileoverview Business Configuration IPC Handlers
 *
 * Handles IPC communication for business configuration operations.
 * Read operations are public, write operations require admin privileges.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { ipcMain } from "electron";
import { ipcLogger } from "@sheetpilot/shared/logger";
import { isTrustedIpcSender } from "./handlers/timesheet/main-window";
import { validateInput } from "@/validation/validate-ipc-input";
import {
  getToolsForProjectSchema,
  validateProjectSchema,
  validateToolForProjectSchema,
  validateChargeCodeSchema,
  businessConfigProjectUpdateSchema,
  businessConfigToolUpdateSchema,
  businessConfigChargeCodeUpdateSchema,
  businessConfigProjectCreateSchema,
  businessConfigToolCreateSchema,
  businessConfigChargeCodeCreateSchema,
  linkToolToProjectSchema,
  unlinkToolFromProjectSchema,
  adminTokenSchema,
} from "@/validation/ipc-schemas";
import { validateSession } from "@/models";
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
} from "@/models";
import type {
  ProjectUpdate,
  ToolUpdate,
  ChargeCodeUpdate,
  ProjectCreate,
  ToolCreate,
  ChargeCodeCreate,
} from "@/models/business-config.repository.types";
import {
  updateProject,
  updateTool,
  updateChargeCode,
  addProject,
  addTool,
  addChargeCode,
  linkToolToProject,
  unlinkToolFromProject,
} from "@/models";

/**
 * Removes undefined properties from an object to satisfy exactOptionalPropertyTypes
 * This ensures optional properties are either present with a value or absent entirely
 */
function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}

/**
 * Register all business configuration IPC handlers
 */
export function registerBusinessConfigHandlers(): void {
  // ============================================================================
  // READ OPERATIONS (No auth required)
  // ============================================================================

  ipcMain.handle("business-config:getAllProjects", async (event) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: "Could not get projects: unauthorized request" };
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

  ipcMain.handle("business-config:getToolsForProject", async (event, project: string) => {
    if (!isTrustedIpcSender(event)) {
      return {
        success: false,
        error: "Could not get tools for project: unauthorized request",
      };
    }

    const validation = validateInput(getToolsForProjectSchema, { project }, "business-config:getToolsForProject");
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
  });

  ipcMain.handle("business-config:getAllTools", async (event) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: "Could not get tools: unauthorized request" };
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

  ipcMain.handle("business-config:validateProject", async (event, project: string) => {
    if (!isTrustedIpcSender(event)) {
      return {
        success: false,
        error: "Could not validate project: unauthorized request",
      };
    }

    const validation = validateInput(validateProjectSchema, { project }, "business-config:validateProject");
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
        const isValid = await isValidToolForProject(validation.data!.tool, validation.data!.project);
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

  ipcMain.handle("business-config:validateChargeCode", async (event, chargeCode: string) => {
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
  });

  // ============================================================================
  // ADMIN WRITE OPERATIONS (Require admin token)
  // ============================================================================

  ipcMain.handle(
    "business-config:updateProject",
    async (event, token: string, id: number, updates: Record<string, unknown>) => {
      if (!isTrustedIpcSender(event)) {
        return {
          success: false,
          error: "Could not update project: unauthorized request",
        };
      }

      const validation = validateInput(
        businessConfigProjectUpdateSchema,
        { token, id, updates },
        "business-config:updateProject"
      );
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      const validatedData = validation.data!;
      const session = validateSession(validatedData.token);

      if (!session.valid || !session.isAdmin) {
        ipcLogger.security("admin-action-denied", "Unauthorized admin action attempted", {
          token: validatedData.token.substring(0, 8) + "...",
        });
        return { success: false, error: "Unauthorized: Admin access required" };
      }

      ipcLogger.audit("admin-update-project", "Admin updating project", {
        email: session.email,
        id: validatedData.id,
      });

      try {
        updateProject(validatedData.id, removeUndefined(validatedData.updates) as ProjectUpdate);
        invalidateCache();
        ipcLogger.info("Project updated by admin", {
          email: session.email,
          id: validatedData.id,
        });
        return { success: true };
      } catch (err: unknown) {
        ipcLogger.error("Could not update project", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  ipcMain.handle(
    "business-config:updateTool",
    async (event, token: string, id: number, updates: Record<string, unknown>) => {
      if (!isTrustedIpcSender(event)) {
        return {
          success: false,
          error: "Could not update tool: unauthorized request",
        };
      }

      const validation = validateInput(
        businessConfigToolUpdateSchema,
        { token, id, updates },
        "business-config:updateTool"
      );
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      const validatedData = validation.data!;
      const session = validateSession(validatedData.token);

      if (!session.valid || !session.isAdmin) {
        ipcLogger.security("admin-action-denied", "Unauthorized admin action attempted", {
          token: validatedData.token.substring(0, 8) + "...",
        });
        return { success: false, error: "Unauthorized: Admin access required" };
      }

      ipcLogger.audit("admin-update-tool", "Admin updating tool", {
        email: session.email,
        id: validatedData.id,
      });

      try {
        updateTool(validatedData.id, removeUndefined(validatedData.updates) as ToolUpdate);
        invalidateCache();
        ipcLogger.info("Tool updated by admin", {
          email: session.email,
          id: validatedData.id,
        });
        return { success: true };
      } catch (err: unknown) {
        ipcLogger.error("Could not update tool", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  ipcMain.handle(
    "business-config:updateChargeCode",
    async (event, token: string, id: number, updates: Record<string, unknown>) => {
      if (!isTrustedIpcSender(event)) {
        return {
          success: false,
          error: "Could not update charge code: unauthorized request",
        };
      }

      const validation = validateInput(
        businessConfigChargeCodeUpdateSchema,
        { token, id, updates },
        "business-config:updateChargeCode"
      );
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      const validatedData = validation.data!;
      const session = validateSession(validatedData.token);

      if (!session.valid || !session.isAdmin) {
        ipcLogger.security("admin-action-denied", "Unauthorized admin action attempted", {
          token: validatedData.token.substring(0, 8) + "...",
        });
        return { success: false, error: "Unauthorized: Admin access required" };
      }

      ipcLogger.audit("admin-update-charge-code", "Admin updating charge code", {
        email: session.email,
        id: validatedData.id,
      });

      try {
        updateChargeCode(validatedData.id, removeUndefined(validatedData.updates) as ChargeCodeUpdate);
        invalidateCache();
        ipcLogger.info("Charge code updated by admin", {
          email: session.email,
          id: validatedData.id,
        });
        return { success: true };
      } catch (err: unknown) {
        ipcLogger.error("Could not update charge code", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  ipcMain.handle(
    "business-config:addProject",
    async (event, token: string, project: Record<string, unknown>) => {
      if (!isTrustedIpcSender(event)) {
        return {
          success: false,
          error: "Could not add project: unauthorized request",
        };
      }

      const validation = validateInput(
        businessConfigProjectCreateSchema,
        { token, project },
        "business-config:addProject"
      );
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      const validatedData = validation.data!;
      const session = validateSession(validatedData.token);

      if (!session.valid || !session.isAdmin) {
        ipcLogger.security("admin-action-denied", "Unauthorized admin action attempted", {
          token: validatedData.token.substring(0, 8) + "...",
        });
        return { success: false, error: "Unauthorized: Admin access required" };
      }

      ipcLogger.audit("admin-add-project", "Admin adding project", {
        email: session.email,
        name: validatedData.project.name,
      });

      try {
        const id = addProject(removeUndefined(validatedData.project) as ProjectCreate);
        invalidateCache();
        ipcLogger.info("Project added by admin", {
          email: session.email,
          id,
          name: validatedData.project.name,
        });
        return { success: true, id };
      } catch (err: unknown) {
        ipcLogger.error("Could not add project", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  ipcMain.handle("business-config:addTool", async (event, token: string, tool: Record<string, unknown>) => {
    if (!isTrustedIpcSender(event)) {
      return {
        success: false,
        error: "Could not add tool: unauthorized request",
      };
    }

    const validation = validateInput(
      businessConfigToolCreateSchema,
      { token, tool },
      "business-config:addTool"
    );
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const validatedData = validation.data!;
    const session = validateSession(validatedData.token);

    if (!session.valid || !session.isAdmin) {
      ipcLogger.security("admin-action-denied", "Unauthorized admin action attempted", {
        token: validatedData.token.substring(0, 8) + "...",
      });
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    ipcLogger.audit("admin-add-tool", "Admin adding tool", {
      email: session.email,
      name: validatedData.tool.name,
    });

    try {
      const id = addTool(removeUndefined(validatedData.tool) as ToolCreate);
      invalidateCache();
      ipcLogger.info("Tool added by admin", {
        email: session.email,
        id,
        name: validatedData.tool.name,
      });
      return { success: true, id };
    } catch (err: unknown) {
      ipcLogger.error("Could not add tool", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle(
    "business-config:addChargeCode",
    async (event, token: string, chargeCode: Record<string, unknown>) => {
      if (!isTrustedIpcSender(event)) {
        return {
          success: false,
          error: "Could not add charge code: unauthorized request",
        };
      }

      const validation = validateInput(
        businessConfigChargeCodeCreateSchema,
        { token, chargeCode },
        "business-config:addChargeCode"
      );
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      const validatedData = validation.data!;
      const session = validateSession(validatedData.token);

      if (!session.valid || !session.isAdmin) {
        ipcLogger.security("admin-action-denied", "Unauthorized admin action attempted", {
          token: validatedData.token.substring(0, 8) + "...",
        });
        return { success: false, error: "Unauthorized: Admin access required" };
      }

      ipcLogger.audit("admin-add-charge-code", "Admin adding charge code", {
        email: session.email,
        name: validatedData.chargeCode.name,
      });

      try {
        const id = addChargeCode(removeUndefined(validatedData.chargeCode) as ChargeCodeCreate);
        invalidateCache();
        ipcLogger.info("Charge code added by admin", {
          email: session.email,
          id,
          name: validatedData.chargeCode.name,
        });
        return { success: true, id };
      } catch (err: unknown) {
        ipcLogger.error("Could not add charge code", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  ipcMain.handle(
    "business-config:linkToolToProject",
    async (event, token: string, projectId: number, toolId: number, displayOrder?: number) => {
      if (!isTrustedIpcSender(event)) {
        return {
          success: false,
          error: "Could not link tool to project: unauthorized request",
        };
      }

      const validation = validateInput(
        linkToolToProjectSchema,
        { token, projectId, toolId, displayOrder },
        "business-config:linkToolToProject"
      );
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      const validatedData = validation.data!;
      const session = validateSession(validatedData.token);

      if (!session.valid || !session.isAdmin) {
        ipcLogger.security("admin-action-denied", "Unauthorized admin action attempted", {
          token: validatedData.token.substring(0, 8) + "...",
        });
        return { success: false, error: "Unauthorized: Admin access required" };
      }

      ipcLogger.audit("admin-link-tool-project", "Admin linking tool to project", {
        email: session.email,
        projectId: validatedData.projectId,
        toolId: validatedData.toolId,
      });

      try {
        linkToolToProject(validatedData.projectId, validatedData.toolId, validatedData.displayOrder);
        invalidateCache();
        ipcLogger.info("Tool linked to project by admin", {
          email: session.email,
          projectId: validatedData.projectId,
          toolId: validatedData.toolId,
        });
        return { success: true };
      } catch (err: unknown) {
        ipcLogger.error("Could not link tool to project", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );

  ipcMain.handle(
    "business-config:unlinkToolFromProject",
    async (event, token: string, projectId: number, toolId: number) => {
      if (!isTrustedIpcSender(event)) {
        return {
          success: false,
          error: "Could not unlink tool from project: unauthorized request",
        };
      }

      const validation = validateInput(
        unlinkToolFromProjectSchema,
        { token, projectId, toolId },
        "business-config:unlinkToolFromProject"
      );
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      const validatedData = validation.data!;
      const session = validateSession(validatedData.token);

      if (!session.valid || !session.isAdmin) {
        ipcLogger.security("admin-action-denied", "Unauthorized admin action attempted", {
          token: validatedData.token.substring(0, 8) + "...",
        });
        return { success: false, error: "Unauthorized: Admin access required" };
      }

      ipcLogger.audit("admin-unlink-tool-project", "Admin unlinking tool from project", {
        email: session.email,
        projectId: validatedData.projectId,
        toolId: validatedData.toolId,
      });

      try {
        unlinkToolFromProject(validatedData.projectId, validatedData.toolId);
        invalidateCache();
        ipcLogger.info("Tool unlinked from project by admin", {
          email: session.email,
          projectId: validatedData.projectId,
          toolId: validatedData.toolId,
        });
        return { success: true };
      } catch (err: unknown) {
        ipcLogger.error("Could not unlink tool from project", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );
}
