/**
 * @fileoverview Application Controller
 *
 * Centralized initialization and coordination for the application.
 * Handles plugin registry, database, routes, and logging setup.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { App, BrowserWindow } from "electron";
import { dialog } from "electron";
import { APP_VERSION } from "@sheetpilot/shared";
import type { LoggerLike } from "@/bootstrap/logging/logger-contract";
import { initializeLoggingOrExit } from "@/bootstrap/logging/init-logging";
import type { loadLoggingModule } from "@/bootstrap/logging/load-logging-module";
import { bootstrapDatabase } from "@/bootstrap/database/bootstrap-database";
import {
  registerIpcHandlers,
  setIpcMainWindow,
} from "@/bootstrap/ipc/register-ipc";
import { registerDefaultPluginsBootstrap } from "@/bootstrap/plugins/register-default-plugins";
import type { RuntimeFlags } from "@/bootstrap/env";

export interface AppControllerParams {
  app: App;
  flags: RuntimeFlags;
  backendDirname: string;
  shimAppLogger: LoggerLike;
  shimDbLogger: LoggerLike;
  logging: Awaited<ReturnType<typeof loadLoggingModule>>;
}

export interface AppControllerResult {
  appLogger: LoggerLike;
  dbLogger: LoggerLike;
}

/**
 * Initialize logging system
 */
export async function initializeLogging(
  params: AppControllerParams
): Promise<{ appLogger: LoggerLike; dbLogger: LoggerLike }> {
  const { app, shimAppLogger, logging } = params;

  if (!initializeLoggingOrExit(app, shimAppLogger, logging.initializeLogging)) {
    throw new Error("Logging initialization failed - application will exit");
  }

  const appLogger: LoggerLike = logging.appLogger;
  const dbLogger: LoggerLike = logging.dbLogger;

  appLogger.info("Application startup initiated", {
    version: APP_VERSION,
    isPackaged: app.isPackaged,
    execPath: app.getPath("exe"),
    userDataPath: app.getPath("userData"),
  });

  return { appLogger, dbLogger };
}

/**
 * Register plugins with the plugin registry
 */
export async function initializePlugins(appLogger: LoggerLike): Promise<void> {
  await registerDefaultPluginsBootstrap(appLogger);
}

/**
 * Initialize database
 */
export function initializeDatabase(app: App, dbLogger: LoggerLike): void {
  try {
    bootstrapDatabase(app, dbLogger);
  } catch (err: unknown) {
    dbLogger.error("Could not initialize database", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    dialog.showErrorBox(
      "Application Startup Error",
      `Could not initialize database:\n\n${
        err instanceof Error ? err.message : String(err)
      }\n\nThe application will now exit.`
    );
    app.exit(1);
    throw err;
  }
}

/**
 * Register IPC/routes handlers
 */
export function initializeRoutes(params: {
  logger: LoggerLike;
  backendDirname: string;
}): void {
  try {
    registerIpcHandlers(params);
  } catch (err: unknown) {
    params.logger.error("Could not register IPC handlers", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    dialog.showErrorBox(
      "Application Startup Error",
      `Could not register IPC handlers:\n\n${
        err instanceof Error ? err.message : String(err)
      }\n\nThe application will now exit.`
    );
    throw err;
  }
}

/**
 * Set the main window reference for IPC handlers
 */
export function setMainWindowReference(
  mainWindow: BrowserWindow | null,
  logger: LoggerLike
): void {
  setIpcMainWindow(mainWindow, logger);
}
