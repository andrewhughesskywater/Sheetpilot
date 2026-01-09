import type { App } from 'electron';

import { bootstrapDatabase } from '../database/bootstrap-database';
import { registerIpcHandlers } from '../ipc/register-ipc';
import type { LoggerLike } from '../logging/logger-contract';

type DatabaseGuardParams = {
  app: App;
  appLogger: LoggerLike;
  dbLogger: LoggerLike;
};

type IpcGuardParams = {
  app: App;
  logger: LoggerLike;
  backendRequire: NodeRequire;
  backendDirname: string;
};

export function bootstrapDatabaseOrExit(params: DatabaseGuardParams): boolean {
  try {
    bootstrapDatabase(params.app, params.dbLogger);
    return true;
  } catch (err: unknown) {
    params.appLogger.error('Could not initialize database', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    const { dialog } = require('electron') as typeof import('electron');
    dialog.showErrorBox(
      'Application Startup Error',
      `Could not initialize database:\n\n${err instanceof Error ? err.message : String(err)}\n\nThe application will now exit.`
    );
    params.app.exit(1);
    return false;
  }
}

export function registerIpcHandlersOrExit(params: IpcGuardParams): boolean {
  try {
    registerIpcHandlers({
      logger: params.logger,
      backendRequire: params.backendRequire,
      backendDirname: params.backendDirname,
    });
    return true;
  } catch (err: unknown) {
    const { dialog } = require('electron') as typeof import('electron');
    dialog.showErrorBox(
      'Application Startup Error',
      `Could not register IPC handlers:\n\n${err instanceof Error ? err.message : String(err)}\n\nThe application will now exit.`
    );
    params.app.exit(1);
    return false;
  }
}
