import { ipcMain } from "electron";
import { ipcLogger } from "@sheetpilot/shared/logger";
import { isTrustedIpcSender } from "@/routes/handlers/timesheet/main-window";
import { validateInput } from "@/validation/validate-ipc-input";
import {
  businessConfigChargeCodeUpdateSchema,
  businessConfigChargeCodeCreateSchema,
} from "@/validation/ipc-schemas";
import { addChargeCode, invalidateCache, updateChargeCode } from "@/models";
import type {
  ChargeCodeCreate,
  ChargeCodeUpdate,
} from "@/models/business-config.repository.types";
import { removeUndefined, requireAdminSession } from "@/routes/business-config-handlers.utils";

export function registerBusinessConfigChargeCodeHandlers(): void {
  ipcMain.handle(
    "business-config:updateChargeCode",
    async (
      event,
      token: string,
      id: number,
      updates: Record<string, unknown>
    ) => {
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
      const adminCheck = requireAdminSession(validatedData.token);
      if (!adminCheck.ok) {
        return adminCheck.response;
      }

      ipcLogger.audit(
        "admin-update-charge-code",
        "Admin updating charge code",
        {
          email: adminCheck.session.email,
          id: validatedData.id,
        }
      );

      try {
        updateChargeCode(
          validatedData.id,
          removeUndefined(validatedData.updates) as ChargeCodeUpdate
        );
        invalidateCache();
        ipcLogger.info("Charge code updated by admin", {
          email: adminCheck.session.email,
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
      const adminCheck = requireAdminSession(validatedData.token);
      if (!adminCheck.ok) {
        return adminCheck.response;
      }

      ipcLogger.audit("admin-add-charge-code", "Admin adding charge code", {
        email: adminCheck.session.email,
        name: validatedData.chargeCode.name,
      });

      try {
        const id = addChargeCode(
          removeUndefined(validatedData.chargeCode) as ChargeCodeCreate
        );
        invalidateCache();
        ipcLogger.info("Charge code added by admin", {
          email: adminCheck.session.email,
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
}
