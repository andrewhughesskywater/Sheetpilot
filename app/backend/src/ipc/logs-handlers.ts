/**
 * @fileoverview Logs IPC Handlers
 *
 * Handles IPC communication for log file operations.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { app,ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import { validateSession } from '../repositories';
import { exportLogsSchema } from '../validation/ipc-schemas';
import { validateInput } from '../validation/validate-ipc-input';
import { isTrustedIpcSender } from './handlers/timesheet/main-window';
import { ipcLogger } from './utils/logger';

/**
 * Export logs as formatted JSON
 */
function exportLogsAsJson(logContent: string): { success: true; content: string; filename: string; mimeType: string } {
  const lines = logContent.split('\n').filter((line: string) => line.trim() !== '');
  const parsedLogs = lines.map((line: string) => {
    try {
      return JSON.parse(line);
    } catch {
      return { raw: line };
    }
  });

  return {
    success: true,
    content: JSON.stringify(parsedLogs, null, 2),
    filename: `sheetpilot_logs_${new Date().toISOString().split('T')[0]}.json`,
    mimeType: 'application/json',
  };
}

/**
 * Export logs as plain text
 */
function exportLogsAsText(logContent: string): { success: true; content: string; filename: string; mimeType: string } {
  return {
    success: true,
    content: logContent,
    filename: `sheetpilot_logs_${new Date().toISOString().split('T')[0]}.txt`,
    mimeType: 'text/plain',
  };
}

/**
 * Register all logs-related IPC handlers
 */
export function registerLogsHandlers(): void {
  // Handler for getting log file path
  ipcMain.handle('logs:getLogPath', async (event, token: string) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not get log path: unauthorized request' };
    }

    if (!token) {
      return { success: false, error: 'Session token is required. Please log in to access logs.' };
    }

    const session = validateSession(token);
    if (!session.valid) {
      return { success: false, error: 'Session is invalid or expired. Please log in again.' };
    }

    try {
      const userDataPath = app.getPath('userData');
      const allFiles = await fs.promises.readdir(userDataPath);
      const logFiles = allFiles.filter((file: string) => file.startsWith('sheetpilot_') && file.endsWith('.log'));

      if (logFiles.length === 0) {
        return { success: false, error: 'No log files found' };
      }

      // Get the most recent log file
      const latestLogFile = logFiles.sort().pop();
      const logPath = path.join(userDataPath, latestLogFile!);

      return { success: true, logPath, logFiles };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  function validateLogPath(
    logPath: string,
    userDataPath: string
  ): { valid: boolean; error?: string; resolvedPath?: string } {
    const resolvedUserDataPath = path.resolve(userDataPath);
    const resolvedLogPath = path.resolve(logPath);
    const logFileName = path.basename(resolvedLogPath);
    const isExpectedLogFile = logFileName.startsWith('sheetpilot_') && logFileName.endsWith('.log');
    const isWithinUserData =
      resolvedLogPath === resolvedUserDataPath || resolvedLogPath.startsWith(resolvedUserDataPath + path.sep);

    if (!isWithinUserData || !isExpectedLogFile) {
      ipcLogger.security('logs-access-denied', 'Unauthorized log path requested', {
        requestedPath: logPath,
        resolvedLogPath,
        userDataPath: resolvedUserDataPath,
      });
      return { valid: false, error: 'Could not export logs: log path not allowed' };
    }

    return { valid: true, resolvedPath: resolvedLogPath };
  }

  async function processLogExport(
    logPath: string,
    exportFormat: 'json' | 'txt'
  ): Promise<{ success: boolean; content?: string; filename?: string; mimeType?: string; error?: string }> {
    try {
      const logContent = await fs.promises.readFile(logPath, 'utf8');

      if (exportFormat === 'json') {
        return exportLogsAsJson(logContent);
      } else {
        return exportLogsAsText(logContent);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  }

  // Handler for exporting logs
  ipcMain.handle(
    'logs:exportLogs',
    async (event, token: string, logPath: string, exportFormat: 'json' | 'txt' = 'txt') => {
      if (!isTrustedIpcSender(event)) {
        return { success: false, error: 'Could not export logs: unauthorized request' };
      }

      if (!token) {
        return { success: false, error: 'Session token is required. Please log in to export logs.' };
      }

      const session = validateSession(token);
      if (!session.valid) {
        return { success: false, error: 'Session is invalid or expired. Please log in again.' };
      }

      // Validate input using Zod schema
      const validation = validateInput(exportLogsSchema, { logPath, exportFormat }, 'logs:exportLogs');
      if (!validation.success) {
        return { success: false, error: validation.error };
      }

      const validatedData = validation.data!;

      try {
        const userDataPath = app.getPath('userData');
        const pathValidation = validateLogPath(validatedData.logPath, userDataPath);
        if (!pathValidation.valid) {
          return { success: false, error: pathValidation.error };
        }

        return await processLogExport(pathValidation.resolvedPath!, validatedData.exportFormat ?? 'txt');
      } catch (err: unknown) {
        ipcLogger.error('Could not export logs', err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}
