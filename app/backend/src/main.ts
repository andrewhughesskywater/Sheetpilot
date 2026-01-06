import { app, screen, type BrowserWindow } from 'electron';
import { createRequire } from 'module';
import { APP_VERSION } from '../../shared/constants';
import { getRuntimeFlags } from './bootstrap/env';
import { registerCrashHandlers } from './bootstrap/crash-handlers/register-crash-handlers';
import { bootstrapDatabase } from './bootstrap/database/bootstrap-database';
import { configureElectronCommandLine } from './bootstrap/electron/configure-commandline';
import { registerIpcHandlers, setIpcMainWindow } from './bootstrap/ipc/register-ipc';
import { initializeLoggingOrExit } from './bootstrap/logging/init-logging';
import type { LoggerLike } from './bootstrap/logging/logger-contract';
import { loadLoggingModule } from './bootstrap/logging/load-logging-module';
import { createShimLogger } from './bootstrap/logging/shim-logger';
import { writeStartupLog } from './bootstrap/logging/startup-log';
import { fixDesktopShortcutIcon } from './bootstrap/os/fix-shortcut-icon';
import { setAppUserModelId } from './bootstrap/os/set-app-user-model-id';
import { registerDefaultPluginsBootstrap } from './bootstrap/plugins/register-default-plugins';
import { configureBackendNodeModuleResolution } from './bootstrap/preflight/configure-module-resolution';
import { ensureDevUserDataPath } from './bootstrap/preflight/ensure-dev-userdata-path';
import { preflightResolveCriticalModules } from './bootstrap/preflight/resolve-critical-modules';
import { createMainWindow } from './bootstrap/windows/create-main-window';
import { loadRenderer } from './bootstrap/windows/load-renderer';
import { createDebouncedWindowStateSaver, getDefaultWindowState, restoreWindowState } from './bootstrap/windows/window-state';
import { initializeSentry } from './bootstrap/observability/sentry-init';

ensureDevUserDataPath(app);

const flags = getRuntimeFlags(app);
configureBackendNodeModuleResolution({ packagedLike: flags.packagedLike, isSmoke: flags.isSmoke, backendDirname: __dirname });

const shimAppLogger = createShimLogger('Application');
const shimDbLogger = createShimLogger('Database');

writeStartupLog(app, __dirname);
preflightResolveCriticalModules(app, shimAppLogger);

const backendRequire = createRequire(__filename);
const logging = loadLoggingModule(backendRequire, { appLogger: shimAppLogger, dbLogger: shimDbLogger });

const appLogger: LoggerLike = logging.appLogger;
const dbLogger: LoggerLike = logging.dbLogger;

configureElectronCommandLine(app);
registerCrashHandlers(app, appLogger);

// === Observability: Initialize Sentry (early in startup sequence) ===
// Must be initialized before window creation to capture startup errors
initializeSentry(flags.isDev, flags.isSmoke, flags.packagedLike, appLogger);

let mainWindow: BrowserWindow | null = null;
const windowStateSaver = createDebouncedWindowStateSaver({
  app,
  logger: appLogger,
  getWindow: () => mainWindow
});

app
  .whenReady()
  .then(async () => {
    if (!initializeLoggingOrExit(app, appLogger, logging.initializeLogging)) {
      return;
    }

    appLogger.info('Application startup initiated', {
      version: APP_VERSION,
      isPackaged: app.isPackaged,
      execPath: app.getPath('exe'),
      userDataPath: app.getPath('userData')
    });

    setAppUserModelId(app, appLogger, 'com.sheetpilot.app');
    appLogger.verbose('Fixing desktop shortcut icon (Windows only)');
    fixDesktopShortcutIcon({ app, logger: appLogger, packagedLike: flags.packagedLike });

    await registerDefaultPluginsBootstrap(appLogger);

    try {
      bootstrapDatabase(app, dbLogger);
    } catch (err: unknown) {
      appLogger.error('Could not initialize database', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });

      const { dialog } = require('electron') as typeof import('electron');
      dialog.showErrorBox(
        'Application Startup Error',
        `Could not initialize database:\n\n${err instanceof Error ? err.message : String(err)}\n\nThe application will now exit.`
      );
      app.exit(1);
      return;
    }

    try {
      registerIpcHandlers({ logger: appLogger, backendRequire, backendDirname: __dirname });
    } catch (err: unknown) {
      const { dialog } = require('electron') as typeof import('electron');
      dialog.showErrorBox(
        'Application Startup Error',
        `Could not register IPC handlers:\n\n${err instanceof Error ? err.message : String(err)}\n\nThe application will now exit.`
      );
      app.exit(1);
      return;
    }

    appLogger.verbose('Creating main application window');
    const windowState = getDefaultWindowState();
    mainWindow = createMainWindow({
      app,
      logger: appLogger,
      packagedLike: flags.packagedLike,
      isSmoke: flags.isSmoke,
      backendDirname: __dirname,
      windowState,
      scheduleWindowStateSave: windowStateSaver.scheduleSave,
      restoreWindowStateAsync: (window) =>
        restoreWindowState({ app, screen, window, logger: appLogger })
    });

    if (!mainWindow) {
      return;
    }

    appLogger.verbose('Main window created', {
      width: mainWindow.getBounds().width,
      height: mainWindow.getBounds().height
    });

    setIpcMainWindow(mainWindow, appLogger);

    void loadRenderer({
      app,
      window: mainWindow,
      logger: appLogger,
      isDev: flags.isDev,
      packagedLike: flags.packagedLike,
      isSmoke: flags.isSmoke,
      backendDirname: __dirname
    });
  })
  .catch((err: unknown) => {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    // Use structured logger for fatal errors when available
    // If logger initialization failed, this code runs before logger is ready, so console is acceptable
    try {
      appLogger.error('Error during app.whenReady()', {
        message: errorMsg,
        stack: errorStack,
      });
    } catch {
      // Logger not available - fall back to console (pre-bootstrap failure)
      console.error('═══════════════════════════════════════════════════════════');
      console.error('FATAL: Error during app.whenReady()');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('Message:', errorMsg);
      if (errorStack) {
        console.error('Stack:', errorStack);
      }
      console.error('═══════════════════════════════════════════════════════════');
    }

    try {
      const { dialog } = require('electron') as typeof import('electron');
      if (app.isReady()) {
        dialog.showErrorBox(
          'Application Startup Error',
          `An error occurred during application startup:\n\n${errorMsg}\n\n${errorStack || ''}\n\nThe application will now exit.`
        );
        setTimeout(() => app.exit(1), 2000);
      } else {
        app.exit(1);
      }
    } catch (dialogErr: unknown) {
      const dialogErrorMsg = dialogErr instanceof Error ? dialogErr.message : String(dialogErr);
      try {
        appLogger.error('Could not show error dialog', { error: dialogErrorMsg });
      } catch {
        // Logger unavailable - console fallback for critical errors only
        console.error('Could not show error dialog:', dialogErr);
      }
      app.exit(1);
    }
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
