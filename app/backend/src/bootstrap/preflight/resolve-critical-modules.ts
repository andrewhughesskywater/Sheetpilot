import type { App } from 'electron';

import type { LoggerLike } from '../logging/logger-contract';

export function preflightResolveCriticalModules(app: App, logger: LoggerLike): void {
  const criticalModules = ['electron-log', 'electron-updater', 'better-sqlite3'];
  const failures: Array<{ name: string; error: string }> = [];

  for (const name of criticalModules) {
    try {
      require.resolve(name);
    } catch (err: unknown) {
      failures.push({ name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (failures.length === 0) {
    return;
  }

  const details = failures.map((f) => `${f.name}: ${f.error}`).join(' | ');
  logger.error('Preflight module resolution failed', {
    details,
    nodePath: process.env['NODE_PATH'],
    resourcesPath: process.resourcesPath,
  });

  // Log to console (will be visible if run from command line)
  console.error('═══════════════════════════════════════════════════════════');
  console.error('FATAL: Application Startup Error');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('Preflight module resolution failed:', details);
  console.error('NODE_PATH:', process.env['NODE_PATH']);
  console.error('Resources path:', process.resourcesPath);
  console.error('═══════════════════════════════════════════════════════════');
  console.error('Please reinstall the application.');
  console.error('Press any key to exit...');

  // Try to show error dialog after app is ready
  let dialogShown = false;
  app
    .whenReady()
    .then(() => {
      try {
        const { dialog } = require('electron') as typeof import('electron');
        dialog.showErrorBox(
          'Application Startup Error',
          `Could not start application. Missing required dependencies:\n\n${details}\n\nPlease reinstall the application.\n\nCheck the log file in: ${app.getPath('userData')}`
        );
        dialogShown = true;
        // Exit after showing dialog
        setTimeout(() => app.exit(1), 2000);
      } catch (err: unknown) {
        console.error('Could not show error dialog:', err);
        app.exit(1);
      }
    })
    .catch(() => {
      // If whenReady fails, just exit
      app.exit(1);
    });

  // Exit after timeout if dialog wasn't shown (prevents hanging)
  setTimeout(() => {
    if (!dialogShown) {
      console.error('App did not become ready, exiting...');
      app.exit(1);
    }
  }, 10000);
}
