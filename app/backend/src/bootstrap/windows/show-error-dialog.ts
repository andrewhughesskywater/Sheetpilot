/**
 * Centralized error dialog handler with Sentry integration.
 *
 * Provides consistent error reporting across startup failures:
 * - Shows user-facing error dialog (2-second timeout before exit)
 * - Captures exception in Sentry before exit
 * - Falls back to console.error if dialog fails
 * - Ensures orderly shutdown with app.exit(code)
 *
 * Industry standard pattern: Sentry capture → user notification → graceful exit
 */

import type { App } from 'electron';

import type { LoggerLike } from '../logging/logger-contract';

export interface ErrorDialogParams {
  app: App;
  logger: LoggerLike;
  error: unknown;
  title: string;
  message: string;
  exitCode?: number;
}

/**
 * Show error dialog with Sentry capture and graceful exit.
 *
 * Flow:
 * 1. Log error with structured context
 * 2. Capture exception in Sentry (if available)
 * 3. Show error dialog (non-blocking)
 * 4. After 2 seconds, exit application with code
 * 5. If dialog fails, fall back to logger
 *
 * @param params Error dialog configuration
 */
export async function showErrorDialog(params: ErrorDialogParams): Promise<void> {
  const { app, logger, error, title, message, exitCode = 1 } = params;

  // 1. Log the error with full context
  logger.error(title, {
    message,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  // 2. Capture in Sentry if available (non-blocking, fire-and-forget)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sentry = (globalThis as any).Sentry;
    if (Sentry && typeof Sentry.captureException === 'function') {
      Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
        tags: {
          context: 'startup',
          errorType: title,
        },
      });
    }
  } catch {
    // Sentry not available or failed - continue without it
  }

  // 3. Show error dialog (best-effort, non-blocking)
  try {
    const { dialog } = require('electron') as typeof import('electron');
    dialog.showErrorBox(title, message);
  } catch (dialogErr: unknown) {
    logger.error('Could not show error dialog', {
      error: dialogErr instanceof Error ? dialogErr.message : String(dialogErr),
    });
  }

  // 4. Schedule exit with 2-second delay to ensure dialog is shown
  setTimeout(() => {
    app.exit(exitCode);
  }, 2000);
}

/**
 * Show error dialog synchronously and exit immediately.
 * Use for critical startup failures where waiting is not acceptable.
 *
 * @param params Error dialog configuration
 */
export function showErrorDialogAndExit(params: Omit<ErrorDialogParams, 'app'> & { app: App }): void {
  void showErrorDialog(params); // Fire async dialog handler
}
