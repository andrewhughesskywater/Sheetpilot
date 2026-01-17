import { ipcMain } from "electron";
import { ipcLogger } from "@sheetpilot/shared/logger";
import { isTrustedIpcSender } from "./handlers/timesheet/main-window";
import { validateInput } from "@/validation/validate-ipc-input";
import {
  businessConfigToolUpdateSchema,
  businessConfigToolCreateSchema,
  linkToolToProjectSchema,
  unlinkToolFromProjectSchema,
} from "@/validation/ipc-schemas";
import {
  addTool,
  invalidateCache,
  linkToolToProject,
  unlinkToolFromProject,
  updateTool,
} from "@/models";
import type {
  ToolCreate,
  ToolUpdate,
} from "@/models/business-config.repository.types";
import { removeUndefined, requireAdminSession } from "./business-config-handlers.utils";

export function registerBusinessConfigToolHandlers(): void {
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
      const adminCheck = requireAdminSession(validatedData.token);
      if (!adminCheck.ok) {
        return adminCheck.response;
      }

      ipcLogger.audit("admin-update-tool", "Admin updating tool", {
        email: adminCheck.session.email,
        id: validatedData.id,
      });

      try {
        updateTool(
          validatedData.id,
          removeUndefined(validatedData.updates) as ToolUpdate
        );
        invalidateCache();
        ipcLogger.info("Tool updated by admin", {
          email: adminCheck.session.email,
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
    "business-config:addTool",
    async (event, token: string, tool: Record<string, unknown>) => {
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
      const adminCheck = requireAdminSession(validatedData.token);
      if (!adminCheck.ok) {
        return adminCheck.response;
      }

      ipcLogger.audit("admin-add-tool", "Admin adding tool", {
        email: adminCheck.session.email,
        name: validatedData.tool.name,
      });

      try {
        const id = addTool(
          removeUndefined(validatedData.tool) as ToolCreate
        );
        invalidateCache();
        ipcLogger.info("Tool added by admin", {
          email: adminCheck.session.email,
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
    }
  );

  ipcMain.handle(
    "business-config:linkToolToProject",
    async (
      event,
      token: string,
      projectId: number,
      toolId: number,
      displayOrder?: number
    ) => {
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
      const adminCheck = requireAdminSession(validatedData.token);
      if (!adminCheck.ok) {
        return adminCheck.response;
      }

      ipcLogger.audit(
        "admin-link-tool-project",
        "Admin linking tool to project",
        {
          email: adminCheck.session.email,
          projectId: validatedData.projectId,
          toolId: validatedData.toolId,
        }
      );

      try {
        linkToolToProject(
          validatedData.projectId,
          validatedData.toolId,
          validatedData.displayOrder
        );
        invalidateCache();
        ipcLogger.info("Tool linked to project by admin", {
          email: adminCheck.session.email,
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
      const adminCheck = requireAdminSession(validatedData.token);
      if (!adminCheck.ok) {
        return adminCheck.response;
      }

      ipcLogger.audit(
        "admin-unlink-tool-project",
        "Admin unlinking tool from project",
        {
          email: adminCheck.session.email,
          projectId: validatedData.projectId,
          toolId: validatedData.toolId,
        }
      );

      try {
        unlinkToolFromProject(validatedData.projectId, validatedData.toolId);
        invalidateCache();
        ipcLogger.info("Tool unlinked from project by admin", {
          email: adminCheck.session.email,
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
