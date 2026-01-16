import { ipcLogger } from "@sheetpilot/shared/logger";
import { validateSession } from "@/models";

type SessionResult = ReturnType<typeof validateSession>;

type AdminSessionValidationResult =
  | { ok: true; session: SessionResult }
  | { ok: false; response: { success: false; error: string } };

export const requireAdminSession = (
  token: string
): AdminSessionValidationResult => {
  const session = validateSession(token);
  if (!session.valid || !session.isAdmin) {
    ipcLogger.security(
      "admin-action-denied",
      "Unauthorized admin action attempted",
      {
        token: token.substring(0, 8) + "...",
      }
    );
    return { ok: false, response: { success: false, error: "Unauthorized: Admin access required" } };
  }
  return { ok: true, session };
};

export const removeUndefined = <T extends Record<string, unknown>>(
  obj: T
): Partial<T> =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
