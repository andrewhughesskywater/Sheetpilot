import type { App } from 'electron';

import type { LoggerLike } from '../logging/logger-contract';

export function setAppUserModelId(app: App, logger: LoggerLike, appId: string): void {
  // Ensure Windows taskbar uses our app identity (affects icon/notifications)
  try {
    app.setAppUserModelId(appId);
    logger.debug('AppUserModelID set', { appId });
  } catch (err: unknown) {
    logger.warn('Could not set AppUserModelID', { error: err instanceof Error ? err.message : String(err) });
  }
}
