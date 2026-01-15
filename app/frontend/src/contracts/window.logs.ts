/**
 * @fileoverview Window API - Log file operations
 */

export {};

declare global {
  interface Window {
    /**
     * Log file operations
     *
     * Access application logs for troubleshooting and support.
     */
    logs?: {
      /** Get log directory path and list of log files */
      getLogPath: (token: string) => Promise<{
        success: boolean;
        logPath?: string;
        logFiles?: string[];
        error?: string;
      }>;
      /** Export logs for download */
      exportLogs: (
        token: string,
        logPath: string,
        format?: "json" | "txt"
      ) => Promise<{
        success: boolean;
        content?: string;
        filename?: string;
        mimeType?: string;
        error?: string;
      }>;
    };
  }
}
