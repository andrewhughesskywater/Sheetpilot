/**
 * @fileoverview Logs IPC Handlers
 *
 * Handles IPC communication for log file operations.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { ipcMain, app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { ipcLogger } from "@sheetpilot/shared/logger";
import { validateSession } from "@/models";
import { isTrustedIpcSender } from "./handlers/timesheet/main-window";
import { validateInput } from "@/validation/validate-ipc-input";
import { exportLogsSchema } from "@/validation/ipc-schemas";

type SessionValidationResult = { error?: string };

const getSessionValidationResult = (
  token: string,
  actionLabel: string
): SessionValidationResult => {
  if (!token) {
    return {
      error: `Session token is required. Please log in to ${actionLabel}.`,
    };
  }

  const session = validateSession(token);
  if (!session.valid) {
    return {
      error: "Session is invalid or expired. Please log in again.",
    };
  }

  return {};
};

const getLatestLogFile = (logFiles: string[]): string | null =>
  logFiles.reduce<string | null>(
    (latest, file) => (latest === null || file > latest ? file : latest),
    null
  );

const buildExportFilename = (extension: "json" | "txt"): string => {
  const dateStamp = new Date().toISOString().split("T")[0];
  return `sheetpilot_logs_${dateStamp}.${extension}`;
};

const exportLogContentAsJson = (logContent: string) => {
  const lines = logContent.split("\n").filter((line) => line.trim() !== "");
  const parsedLogs = lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { raw: line };
    }
  });

  return {
    content: JSON.stringify(parsedLogs, null, 2),
    filename: buildExportFilename("json"),
    mimeType: "application/json",
  };
};

const exportLogContentAsText = (logContent: string) => ({
  content: logContent,
  filename: buildExportFilename("txt"),
  mimeType: "text/plain",
});

const getValidatedLogExport = (
  logPath: string,
  exportFormat: "json" | "txt"
):
  | { success: true; data: { logPath: string; exportFormat: "json" | "txt" } }
  | { success: false; error: string } => {
  const validation = validateInput(
    exportLogsSchema,
    { logPath, exportFormat },
    "logs:exportLogs"
  );
  if (!validation.success) {
    return { success: false, error: validation.error ?? "Validation failed" };
  }
  const { logPath: validatedLogPath, exportFormat: validatedExportFormat } =
    validation.data!;
  return {
    success: true,
    data: {
      logPath: validatedLogPath,
      exportFormat: validatedExportFormat ?? ("json" as const),
    },
  };
};

const isAllowedLogPath = (
  resolvedLogPath: string,
  resolvedUserDataPath: string,
  logFileName: string
): boolean => {
  const isExpectedLogFile =
    logFileName.startsWith("sheetpilot_") && logFileName.endsWith(".log");
  const isWithinUserData =
    resolvedLogPath === resolvedUserDataPath ||
    resolvedLogPath.startsWith(resolvedUserDataPath + path.sep);
  return isExpectedLogFile && isWithinUserData;
};

/**
 * Register all logs-related IPC handlers
 */
export function registerLogsHandlers(): void {
  // Handler for getting log file path
  ipcMain.handle("logs:getLogPath", async (event, token: string) => {
    if (!isTrustedIpcSender(event)) {
      return {
        success: false,
        error: "Could not get log path: unauthorized request",
      };
    }

    const sessionValidation = getSessionValidationResult(token, "access logs");
    if (sessionValidation.error) {
      return { success: false, error: sessionValidation.error };
    }

    try {
      const userDataPath = app.getPath("userData");
      const allFiles = await fs.promises.readdir(userDataPath);
      const logFiles = allFiles.filter(
        (file: string) =>
          file.startsWith("sheetpilot_") && file.endsWith(".log")
      );

      if (logFiles.length === 0) {
        return { success: false, error: "No log files found" };
      }

      // Get the most recent log file
      const latestLogFile = getLatestLogFile(logFiles);
      if (!latestLogFile) {
        return { success: false, error: "No log files found" };
      }
      const logPath = path.join(userDataPath, latestLogFile!);

      return { success: true, logPath, logFiles };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Handler for exporting logs
  ipcMain.handle(
    "logs:exportLogs",
    async (
      event,
      token: string,
      logPath: string,
      exportFormat: "json" | "txt" = "txt"
    ) => {
      if (!isTrustedIpcSender(event)) {
        return {
          success: false,
          error: "Could not export logs: unauthorized request",
        };
      }

      const sessionValidation = getSessionValidationResult(
        token,
        "export logs"
      );
      if (sessionValidation.error) {
        return { success: false, error: sessionValidation.error };
      }

      const validation = getValidatedLogExport(logPath, exportFormat);
      if (!validation.success) {
        return { success: false, error: validation.error };
      }
      const validatedData = validation.data;

      try {
        const userDataPath = app.getPath("userData");
        const resolvedUserDataPath = path.resolve(userDataPath);
        const resolvedLogPath = path.resolve(validatedData.logPath);
        const logFileName = path.basename(resolvedLogPath);
        if (
          !isAllowedLogPath(resolvedLogPath, resolvedUserDataPath, logFileName)
        ) {
          ipcLogger.security(
            "logs-access-denied",
            "Unauthorized log path requested",
            {
              requestedPath: validatedData.logPath,
              resolvedLogPath,
              userDataPath: resolvedUserDataPath,
            }
          );
          return {
            success: false,
            error: "Could not export logs: log path not allowed",
          };
        }

        const logContent = await fs.promises.readFile(
          validatedData.logPath,
          "utf8"
        );

        if (validatedData.exportFormat === "json") {
          const exportResult = exportLogContentAsJson(logContent);
          return { success: true, ...exportResult };
        }

        const exportResult = exportLogContentAsText(logContent);
        return { success: true, ...exportResult };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return { success: false, error: errorMessage };
      }
    }
  );
}
