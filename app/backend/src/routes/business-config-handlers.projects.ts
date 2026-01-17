import { ipcMain } from "electron";
import { ipcLogger } from "@sheetpilot/shared/logger";
import { isTrustedIpcSender } from "./handlers/timesheet/main-window";
import { validateInput } from "@/validation/validate-ipc-input";
import {
  businessConfigProjectUpdateSchema,
  businessConfigProjectCreateSchema,
} from "@/validation/ipc-schemas";
import { addProject, invalidateCache, updateProject } from "@/models";
import type {
  ProjectCreate,
  ProjectUpdate,
} from "@/models/business-config.repository.types";
import { removeUndefined, requireAdminSession } from "./business-config-handlers.utils";

export function registerBusinessConfigProjectHandlers(): void {
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
      const adminCheck = requireAdminSession(validatedData.token);
      if (!adminCheck.ok) {
        return adminCheck.response;
      }

      ipcLogger.audit("admin-update-project", "Admin updating project", {
        email: adminCheck.session.email,
        id: validatedData.id,
      });

      try {
        updateProject(
          validatedData.id,
          removeUndefined(validatedData.updates) as ProjectUpdate
        );
        invalidateCache();
        ipcLogger.info("Project updated by admin", {
          email: adminCheck.session.email,
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
      const adminCheck = requireAdminSession(validatedData.token);
      if (!adminCheck.ok) {
        return adminCheck.response;
      }

      ipcLogger.audit("admin-add-project", "Admin adding project", {
        email: adminCheck.session.email,
        name: validatedData.project.name,
      });

      try {
        const id = addProject(
          removeUndefined(validatedData.project) as ProjectCreate
        );
        invalidateCache();
        ipcLogger.info("Project added by admin", {
          email: adminCheck.session.email,
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
}
