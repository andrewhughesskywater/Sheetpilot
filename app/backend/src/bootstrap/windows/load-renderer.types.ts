import type { App, BrowserWindow } from 'electron';

import type { LoggerLike } from '../logging/logger-contract';

export type RendererLoadParams = {
  app: App;
  window: BrowserWindow;
  logger: LoggerLike;
  isDev: boolean;
  packagedLike: boolean;
  isSmoke: boolean;
  backendDirname: string;
};
