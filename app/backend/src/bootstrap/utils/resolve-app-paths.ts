/**
 * Application path resolution with dual validation strategy:
 * - Sync validation: Preload (critical) - blocks startup if missing
 * - Async validation: Icon (non-critical) - deferred post-window-creation
 */

import * as fs from 'fs';
import * as path from 'path';
import type { LoggerLike } from '../logging/logger-contract';

export interface AppPathsResolved {
  preloadPath: string;
  iconPath: string | undefined;
}

/**
 * Synchronously validate preload path (critical for startup).
 * Throws if preload does not exist.
 */
export function resolvePreloadPath(backendDirname: string): string {
  const preloadPath = path.join(backendDirname, 'preload.js');

  if (!fs.existsSync(preloadPath)) {
    throw new Error(
      `Preload script not found at: ${preloadPath}\n` +
      `backendDirname: ${backendDirname}\n` +
      `Please rebuild the application.`
    );
  }

  return preloadPath;
}

/**
 * Synchronously resolve icon path (non-critical).
 * Returns undefined if packaged or path doesn't exist (will be logged asynchronously).
 */
export function resolveIconPathSync(backendDirname: string, packagedLike: boolean): string | undefined {
  if (packagedLike) {
    return undefined;
  }

  const iconPath = path.join(backendDirname, '..', '..', '..', '..', 'app', 'frontend', 'src', 'assets', 'images', 'icon.ico');
  return iconPath;
}

/**
 * Asynchronously validate icon path (non-critical, deferred).
 * Logs warning if icon doesn't exist but doesn't block startup.
 */
export async function validateIconPathAsync(
  iconPath: string | undefined,
  logger: LoggerLike
): Promise<void> {
  if (!iconPath) {
    return;
  }

  try {
    const stats = await fs.promises.stat(iconPath);
    if (!stats.isFile()) {
      logger.warn('Icon path is not a file', { iconPath });
    }
  } catch (err: unknown) {
    logger.warn('Could not validate icon path', {
      iconPath,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

/**
 * Resolve all application paths synchronously (preload required, icon optional).
 * Icon validation deferred to async call.
 */
export function resolveAppPathsSync(backendDirname: string, packagedLike: boolean): AppPathsResolved {
  return {
    preloadPath: resolvePreloadPath(backendDirname),
    iconPath: resolveIconPathSync(backendDirname, packagedLike)
  };
}
