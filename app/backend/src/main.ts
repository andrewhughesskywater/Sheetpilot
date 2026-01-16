import { app, dialog, screen, type BrowserWindow } from "electron";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getRuntimeFlags } from "./bootstrap/env";
import { registerCrashHandlers } from "./bootstrap/crash-handlers/register-crash-handlers";
import { configureElectronCommandLine } from "./bootstrap/electron/configure-commandline";
import { loadLoggingModule } from "./bootstrap/logging/load-logging-module";
import { createShimLogger } from "./bootstrap/logging/shim-logger";
import { writeStartupLog } from "./bootstrap/logging/startup-log";
import { fixDesktopShortcutIcon } from "./bootstrap/os/fix-shortcut-icon";
import { setAppUserModelId } from "./bootstrap/os/set-app-user-model-id";
import { configureBackendNodeModuleResolution } from "./bootstrap/preflight/configure-module-resolution";
import { ensureDevUserDataPath } from "./bootstrap/preflight/ensure-dev-userdata-path";
import { preflightResolveCriticalModules } from "./bootstrap/preflight/resolve-critical-modules";
import { createMainWindow } from "./bootstrap/windows/create-main-window";
import { loadRenderer } from "./bootstrap/windows/load-renderer";
import {
  createDebouncedWindowStateSaver,
  getDefaultWindowState,
  restoreWindowState,
} from "./bootstrap/windows/window-state";
import {
  initializeLogging,
  initializePlugins,
  initializeDatabase,
  initializeRoutes,
  setMainWindowReference,
} from "./core/AppController";
import type { LoggerLike } from "./bootstrap/logging/logger-contract";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

ensureDevUserDataPath(app);

const flags = getRuntimeFlags(app);
configureBackendNodeModuleResolution({
  packagedLike: flags.packagedLike,
  isSmoke: flags.isSmoke,
  backendDirname: __dirname,
});

const shimAppLogger = createShimLogger("Application");
const shimDbLogger = createShimLogger("Database");

writeStartupLog(app, __dirname);
preflightResolveCriticalModules(app, shimAppLogger);

// Initialize logging module asynchronously
const loggingPromise = loadLoggingModule({
  appLogger: shimAppLogger,
  dbLogger: shimDbLogger,
});

// Loggers will be initialized in AppController
const appLogger: LoggerLike = shimAppLogger;

configureElectronCommandLine(app);
registerCrashHandlers(app, appLogger);

let mainWindow: BrowserWindow | null = null;
const windowStateSaver = createDebouncedWindowStateSaver({
  app,
  logger: appLogger,
  getWindow: () => mainWindow,
});

app
  .whenReady()
  .then(async () => {
    // Load logging module
    const logging = await loggingPromise;

    // Initialize logging
    const { appLogger, dbLogger } = await initializeLogging({
      app,
      flags,
      backendDirname: __dirname,
      shimAppLogger,
      shimDbLogger,
      logging,
    });

    setAppUserModelId(app, appLogger, "com.sheetpilot.app");
    appLogger.verbose("Fixing desktop shortcut icon (Windows only)");
    fixDesktopShortcutIcon({
      app,
      logger: appLogger,
      packagedLike: flags.packagedLike,
    });

    // Initialize plugins
    await initializePlugins(appLogger);

    // Initialize database
    initializeDatabase(app, dbLogger);

    // Initialize routes (IPC handlers)
    initializeRoutes({
      logger: appLogger,
      backendDirname: __dirname,
    });

    appLogger.verbose("Creating main application window");
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
        restoreWindowState({ app, screen, window, logger: appLogger }),
    });

    if (!mainWindow) {
      return;
    }

    appLogger.verbose("Main window created", {
      width: mainWindow.getBounds().width,
      height: mainWindow.getBounds().height,
    });

    setMainWindowReference(mainWindow, appLogger);

    void loadRenderer({
      app,
      window: mainWindow,
      logger: appLogger,
      isDev: flags.isDev,
      packagedLike: flags.packagedLike,
      isSmoke: flags.isSmoke,
      backendDirname: __dirname,
    });
  })
  .catch((err: unknown) => {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    console.error(
      "═══════════════════════════════════════════════════════════"
    );
    console.error("FATAL: Error during app.whenReady()");
    console.error(
      "═══════════════════════════════════════════════════════════"
    );
    console.error("Message:", errorMsg);
    if (errorStack) {
      console.error("Stack:", errorStack);
    }
    console.error(
      "═══════════════════════════════════════════════════════════"
    );

    try {
      if (app.isReady()) {
        dialog.showErrorBox(
          "Application Startup Error",
          `An error occurred during application startup:\n\n${errorMsg}\n\n${
            errorStack || ""
          }\n\nThe application will now exit.`
        );
        setTimeout(() => app.exit(1), 2000);
      } else {
        app.exit(1);
      }
    } catch (dialogErr: unknown) {
      console.error("Could not show error dialog:", dialogErr);
      app.exit(1);
    }
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
