/**
 * @fileoverview Window API - Structured logging
 */

export {};

declare global {
  interface Window {
    /**
     * Structured logging API
     *
     * Logs written to file in NDJSON format with automatic PII redaction.
     */
    logger?: {
      /** Log error level message */
      error: (message: string, data?: unknown) => void;
      /** Log warning level message */
      warn: (message: string, data?: unknown) => void;
      /** Log info level message */
      info: (message: string, data?: unknown) => void;
      /** Log verbose level message */
      verbose: (message: string, data?: unknown) => void;
      /** Log debug level message */
      debug: (message: string, data?: unknown) => void;
      /** Log user action for analytics */
      userAction: (action: string, data?: unknown) => void;
    };
  }
}
