/**
 * @fileoverview Logs IPC Handlers
 * 
 * Handles IPC communication for log file operations.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { validateInput } from '../validation/validate-ipc-input';
import { readLogFileSchema, exportLogsSchema } from '../validation/ipc-schemas';

/**
 * Register all logs-related IPC handlers
 */
export function registerLogsHandlers(): void {
  
  // Handler for getting log file path
  ipcMain.handle('logs:getLogPath', async () => {
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

  // Handler for reading log file contents with pagination
  ipcMain.handle('logs:readLogFile', async (_event, logPath: string, options?: { page?: number; pageSize?: number }) => {
    // Validate input using Zod schema
    const validation = validateInput(readLogFileSchema, { logPath }, 'logs:readLogFile');
    if (!validation.success) {
      return { success: false, error: validation.error };
    }
    
    const validatedData = validation.data!;
    
    try {
      const logContent = await fs.promises.readFile(validatedData.logPath, 'utf8');
      const lines = logContent.split('\n').filter((line: string) => line.trim() !== '');
      
      // Pagination parameters with defaults
      const page = options?.page ?? 0;
      const pageSize = options?.pageSize ?? 100; // Default 100 lines per page
      const offset = page * pageSize;
      const totalLines = lines.length;
      const totalPages = Math.ceil(totalLines / pageSize);
      
      // Get paginated lines
      const paginatedLines = lines.slice(offset, offset + pageSize);
      
      // Parse JSON log entries
      const parsedLogs = paginatedLines.map((line: string, index: number) => {
        try {
          const parsed = JSON.parse(line);
          return { lineNumber: offset + index + 1, ...parsed };
        } catch {
          return { lineNumber: offset + index + 1, raw: line };
        }
      });
      
      return { 
        success: true, 
        logs: parsedLogs, 
        totalLines,
        page,
        pageSize,
        totalPages
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Handler for exporting logs
  ipcMain.handle('logs:exportLogs', async (_event, logPath: string, exportFormat: 'json' | 'txt' = 'txt') => {
    // Validate input using Zod schema
    const validation = validateInput(exportLogsSchema, { logPath, exportFormat }, 'logs:exportLogs');
    if (!validation.success) {
      return { success: false, error: validation.error };
    }
    
    const validatedData = validation.data!;
    
    try {
      const logContent = await fs.promises.readFile(validatedData.logPath, 'utf8');
      
      if (validatedData.exportFormat === 'json') {
        // Export as formatted JSON
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
          mimeType: 'application/json'
        };
      } else {
        // Export as plain text
        return {
          success: true,
          content: logContent,
          filename: `sheetpilot_logs_${new Date().toISOString().split('T')[0]}.txt`,
          mimeType: 'text/plain'
        };
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });
}


