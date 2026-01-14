import type { App } from 'electron';
import type { LoggerLike } from '@/bootstrap/logging/logger-contract';

export function registerCrashHandlers(app: App, logger: LoggerLike): void {
  // Global safety nets for unhandled errors
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception detected', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Always log to console first
    console.error('═══════════════════════════════════════════════════════════');
    console.error('FATAL: Uncaught Exception');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Message:', error.message);
    console.error('Name:', error.name);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    console.error('═══════════════════════════════════════════════════════════');

    // Show error dialog if app is ready
    let dialogShown = false;
    if (app.isReady()) {
      try {
        const { dialog } = require('electron') as typeof import('electron');
        dialog.showErrorBox(
          'Application Error',
          `An unexpected error occurred:\n\n${error.message}\n\n${error.stack || ''}\n\nThe application will now exit.`
        );
        dialogShown = true;
      } catch (err: unknown) {
        console.error('Could not show error dialog:', err);
      }
    }

    // Exit after a delay to allow error dialog to be shown
    setTimeout(() => {
      app.exit(1);
    }, dialogShown ? 2000 : 100);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection detected', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined
    });
  });

  process.on('rejectionHandled', () => {
    logger.warn('Application handled previously unhandled rejection');
  });
}


