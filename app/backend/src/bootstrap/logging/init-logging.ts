import type { App } from 'electron';
import type { LoggerLike } from './logger-contract';

export function initializeLoggingOrExit(app: App, logger: LoggerLike, initializeLogging: () => void): boolean {
  // Initialize logging first (fast, non-blocking)
  try {
    initializeLogging();
    return true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('═══════════════════════════════════════════════════════════');
    console.error('FATAL: Could not initialize logging');
    console.error('═══════════════════════════════════════════════════════════');
    console.error(errorMsg);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    console.error('═══════════════════════════════════════════════════════════');

    try {
      const { dialog } = require('electron') as typeof import('electron');
      dialog.showErrorBox(
        'Application Startup Error',
        `Could not initialize logging system:\n\n${errorMsg}\n\nThe application will now exit.`
      );
      setTimeout(() => app.exit(1), 2000);
    } catch (dialogErr: unknown) {
      logger.error('Could not show error dialog', { error: dialogErr instanceof Error ? dialogErr.message : String(dialogErr) });
      app.exit(1);
    }
    return false;
  }
}


