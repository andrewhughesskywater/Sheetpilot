import * as fs from 'fs';
import * as path from 'path';
import type { App, BrowserWindow } from 'electron';
import type { LoggerLike } from '../logging/logger-contract';

export async function loadRenderer(params: {
  app: App;
  window: BrowserWindow;
  logger: LoggerLike;
  isDev: boolean;
  packagedLike: boolean;
  isSmoke: boolean;
  backendDirname: string;
}): Promise<void> {
  if (params.isDev) {
    params.logger.verbose('Loading development URL with splash', { url: 'http://localhost:5173#splash' });
    await params.window.loadURL('http://localhost:5173#splash');
    return;
  }

  const htmlPath = 'app/frontend/dist/index.html';
  params.logger.verbose('Using relative path with loadFile for ASAR path resolution', {
    htmlPath,
    appPath: params.app.getAppPath(),
    backendDirname: params.backendDirname,
    resourcesPath: process.resourcesPath,
    isPackaged: params.app.isPackaged
  });

  const absoluteHtmlPath = path.join(params.app.getAppPath(), htmlPath);
  const fileExists = fs.existsSync(absoluteHtmlPath);
  const fileStats: { size?: number; readable?: boolean; error?: string; assetReferences?: string[] } = {};

  if (fileExists) {
    try {
      const stats = fs.statSync(absoluteHtmlPath);
      fileStats.size = stats.size;
      try {
        const content = fs.readFileSync(absoluteHtmlPath, { encoding: 'utf8', flag: 'r' });
        fileStats.readable = true;
        const assetReferences = content.match(/src="([^"]+)"/g) || [];
        fileStats.assetReferences = assetReferences.slice(0, 5);
      } catch (readErr: unknown) {
        fileStats.readable = false;
        fileStats.error = readErr instanceof Error ? readErr.message : String(readErr);
      }
    } catch (statErr: unknown) {
      fileStats.error = statErr instanceof Error ? statErr.message : String(statErr);
    }
  }

  const unpackedDir = params.packagedLike ? path.join(process.resourcesPath, 'app.asar.unpacked') : null;
  const unpackedDirInfo: { exists?: boolean; contents?: string[] } = {};
  if (unpackedDir && fs.existsSync(unpackedDir)) {
    unpackedDirInfo.exists = true;
    try {
      unpackedDirInfo.contents = fs.readdirSync(unpackedDir);
    } catch {
      unpackedDirInfo.contents = [];
    }
  }

  params.logger.verbose('Loading production HTML with splash', {
    htmlPath,
    absoluteHtmlPath,
    fileExists,
    fileStats,
    unpackedDir,
    unpackedDirInfo,
    backendDirname: params.backendDirname,
    isPackaged: params.app.isPackaged,
    resourcesPath: process.resourcesPath
  });

  if (!fileExists) {
    const errorMsg = `Frontend HTML file not found at: ${absoluteHtmlPath}\nRelative path: ${htmlPath}\nbackendDirname: ${params.backendDirname}\nresourcesPath: ${process.resourcesPath}\nisPackaged: ${params.app.isPackaged}\nUnpacked dir exists: ${unpackedDirInfo.exists}\nPlease rebuild the application.`;
    params.logger.error('Frontend HTML file not found', {
      htmlPath,
      absoluteHtmlPath,
      backendDirname: params.backendDirname,
      resourcesPath: process.resourcesPath,
      isPackaged: params.app.isPackaged,
      unpackedDirInfo
    });
    const { dialog } = require('electron') as typeof import('electron');
    dialog.showErrorBox('Application Startup Error', errorMsg);
    params.app.exit(1);
    return;
  }

  if (fileStats.readable === false) {
    const errorMsg = `Frontend HTML file exists but cannot be read: ${absoluteHtmlPath}\nError: ${fileStats.error}\nPlease check file permissions.`;
    params.logger.error('Frontend HTML file not readable', {
      htmlPath,
      absoluteHtmlPath,
      fileStats
    });
    const { dialog } = require('electron') as typeof import('electron');
    dialog.showErrorBox('Application Startup Error', errorMsg);
    params.app.exit(1);
    return;
  }

  const assetsDir = path.join(path.dirname(absoluteHtmlPath), 'assets');
  const assetsDirExists = fs.existsSync(assetsDir);
  params.logger.verbose('Checking assets directory', { assetsDir, assetsDirExists });

  if (!assetsDirExists) {
    params.logger.error('Assets directory not found', { assetsDir, htmlPath });
    const { dialog } = require('electron') as typeof import('electron');
    dialog.showErrorBox(
      'Application Startup Error',
      `Frontend assets directory not found at: ${assetsDir}\n\nThe HTML file exists but its assets are missing.\n\nPlease rebuild the application.`
    );
    params.app.exit(1);
    return;
  }

  params.logger.verbose('Loading HTML with loadFile (relative path)', { htmlPath, absoluteHtmlPath, assetsDir });

  try {
    await params.window.loadFile(htmlPath);
    params.logger.info('loadFile promise resolved successfully');
    setTimeout(() => {
      if (!params.window.isDestroyed()) {
        params.window.webContents
          .executeJavaScript('window.location.hash = "splash";')
          .catch((err: unknown) => {
            params.logger.debug('Could not set splash hash', { error: err instanceof Error ? err.message : String(err) });
          });
      }
    }, 100);
  } catch (err: unknown) {
    params.logger.error('loadFile promise rejected', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      htmlPath,
      absoluteHtmlPath,
      appPath: params.app.getAppPath(),
      assetsDir,
      assetsDirExists,
      isPackaged: params.app.isPackaged,
      resourcesPath: process.resourcesPath
    });

    try {
      const { dialog } = require('electron') as typeof import('electron');
      dialog.showErrorBox(
        'Failed to Load Application',
        `Could not load the application interface:\n\nError: ${err instanceof Error ? err.message : String(err)}\n\nRelative Path: ${htmlPath}\n\nAbsolute Path: ${absoluteHtmlPath}\n\nApp Path: ${params.app.getAppPath()}\n\nAssets dir: ${assetsDir} (exists: ${assetsDirExists})\n\nPlease check the log file for more details.`
      );
    } catch (dialogErr: unknown) {
      params.logger.error('Could not show error dialog', {
        error: dialogErr instanceof Error ? dialogErr.message : String(dialogErr)
      });
    }
  }

  // Add timeout to show window even if ready-to-show doesn't fire
  setTimeout(() => {
    if (!params.window.isDestroyed() && !params.window.isVisible()) {
      params.logger.warn('Window not shown after timeout, forcing show', {
        isVisible: params.window.isVisible(),
        readyToShow: false
      });
      params.window.show();
    }
  }, 5000);
}


