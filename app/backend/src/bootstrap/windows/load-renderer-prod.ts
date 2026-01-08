import * as fs from 'fs';
import * as path from 'path';
import type { RendererLoadParams } from './load-renderer.types';

const SPLASH_HASH_SCRIPT = 'window.location.hash = "splash";';
const HTML_RELATIVE_PATH = 'app/frontend/dist/index.html';

export async function loadRendererProd(params: RendererLoadParams): Promise<void> {
  const paths = buildPathInfo(params);
  logPathDiagnostics(params, paths);

  if (!paths.html.exists) {
    return showErrorAndExit(params, paths, 'Frontend HTML file not found', buildMissingHtmlMessage(params, paths));
  }

  if (paths.html.fileStats.readable === false) {
    return showErrorAndExit(params, paths, 'Frontend HTML file not readable', buildUnreadableMessage(paths));
  }

  if (!paths.assets.exists) {
    return showErrorAndExit(params, paths, 'Assets directory not found', buildMissingAssetsMessage(paths));
  }

  await loadHtml(params, paths);
  forceShowWindow(params);
}

function buildPathInfo(params: RendererLoadParams): PathInfo {
  const absoluteHtmlPath = path.join(params.app.getAppPath(), HTML_RELATIVE_PATH);
  const htmlStats = collectHtmlStats(absoluteHtmlPath);
  const unpackedDir = params.packagedLike ? path.join(process.resourcesPath, 'app.asar.unpacked') : null;
  const unpackedInfo = collectUnpackedInfo(unpackedDir);
  const assetsDir = path.join(path.dirname(absoluteHtmlPath), 'assets');
  const assetsExists = fs.existsSync(assetsDir);

  return {
    html: {
      relativePath: HTML_RELATIVE_PATH,
      absolutePath: absoluteHtmlPath,
      exists: htmlStats.exists,
      fileStats: htmlStats.fileStats
    },
    unpacked: {
      path: unpackedDir,
      exists: unpackedInfo.exists,
      contents: unpackedInfo.contents
    },
    assets: {
      path: assetsDir,
      exists: assetsExists
    }
  };
}

function collectHtmlStats(absoluteHtmlPath: string): { exists: boolean; fileStats: FileStats } {
  const fileStats: FileStats = {};
  const exists = fs.existsSync(absoluteHtmlPath);

  if (!exists) {
    return { exists, fileStats };
  }

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

  return { exists, fileStats };
}

function collectUnpackedInfo(unpackedDir: string | null): { exists?: boolean; contents?: string[] } {
  if (!unpackedDir || !fs.existsSync(unpackedDir)) {
    return {};
  }
  try {
    return { exists: true, contents: fs.readdirSync(unpackedDir) };
  } catch {
    return { exists: true, contents: [] };
  }
}

async function loadHtml(params: RendererLoadParams, paths: PathInfo): Promise<void> {
  params.logger.verbose('Loading production HTML with splash', {
    htmlPath: paths.html.relativePath,
    absoluteHtmlPath: paths.html.absolutePath,
    fileExists: paths.html.exists,
    fileStats: paths.html.fileStats,
    unpackedDir: paths.unpacked.path,
    unpackedDirInfo: paths.unpacked,
    backendDirname: params.backendDirname,
    isPackaged: params.app.isPackaged,
    resourcesPath: process.resourcesPath
  });

  try {
    await params.window.loadFile(paths.html.relativePath);
    params.logger.info('loadFile promise resolved successfully');
    setTimeout(() => {
      if (!params.window.isDestroyed()) {
        params.window.webContents
          .executeJavaScript(SPLASH_HASH_SCRIPT)
          .catch((err: unknown) => {
            params.logger.debug('Could not set splash hash', { error: err instanceof Error ? err.message : String(err) });
          });
      }
    }, 100);
  } catch (err: unknown) {
    params.logger.error('loadFile promise rejected', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      htmlPath: paths.html.relativePath,
      absoluteHtmlPath: paths.html.absolutePath,
      appPath: params.app.getAppPath(),
      assetsDir: paths.assets.path,
      assetsDirExists: paths.assets.exists,
      isPackaged: params.app.isPackaged,
      resourcesPath: process.resourcesPath
    });

    try {
      const { dialog } = require('electron') as typeof import('electron');
      dialog.showErrorBox(
        'Failed to Load Application',
        `Could not load the application interface:\n\nError: ${err instanceof Error ? err.message : String(err)}\n\nRelative Path: ${paths.html.relativePath}\n\nAbsolute Path: ${paths.html.absolutePath}\n\nApp Path: ${params.app.getAppPath()}\n\nAssets dir: ${paths.assets.path} (exists: ${paths.assets.exists})\n\nPlease check the log file for more details.`
      );
    } catch (dialogErr: unknown) {
      params.logger.error('Could not show error dialog', {
        error: dialogErr instanceof Error ? dialogErr.message : String(dialogErr)
      });
    }
  }
}

function forceShowWindow(params: RendererLoadParams): void {
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

function showErrorAndExit(params: RendererLoadParams, paths: PathInfo, logMessage: string, dialogMessage: string): void {
  params.logger.error(logMessage, {
    htmlPath: paths.html.relativePath,
    absoluteHtmlPath: paths.html.absolutePath,
    backendDirname: params.backendDirname,
    resourcesPath: process.resourcesPath,
    isPackaged: params.app.isPackaged
  });

  const { dialog } = require('electron') as typeof import('electron');
  dialog.showErrorBox('Application Startup Error', dialogMessage);
  params.app.exit(1);
}

function buildMissingHtmlMessage(params: RendererLoadParams, paths: PathInfo): string {
  return `Frontend HTML file not found at: ${paths.html.absolutePath}\nRelative path: ${paths.html.relativePath}\nbackendDirname: ${params.backendDirname}\nresourcesPath: ${process.resourcesPath}\nisPackaged: ${params.app.isPackaged}\nUnpacked dir exists: ${paths.unpacked.exists}\nPlease rebuild the application.`;
}

function buildUnreadableMessage(paths: PathInfo): string {
  return `Frontend HTML file exists but cannot be read: ${paths.html.absolutePath}\nError: ${paths.html.fileStats.error}\nPlease check file permissions.`;
}

function buildMissingAssetsMessage(paths: PathInfo): string {
  return `Frontend assets directory not found at: ${paths.assets.path}\n\nThe HTML file exists but its assets are missing.\n\nPlease rebuild the application.`;
}

function logPathDiagnostics(params: RendererLoadParams, paths: PathInfo): void {
  params.logger.verbose('Using relative path with loadFile for ASAR path resolution', {
    htmlPath: paths.html.relativePath,
    appPath: params.app.getAppPath(),
    backendDirname: params.backendDirname,
    resourcesPath: process.resourcesPath,
    isPackaged: params.app.isPackaged
  });
}

type FileStats = {
  size?: number;
  readable?: boolean;
  error?: string;
  assetReferences?: string[];
};

type PathInfo = {
  html: {
    relativePath: string;
    absolutePath: string;
    exists: boolean;
    fileStats: FileStats;
  };
  unpacked: {
    path: string | null;
    exists?: boolean;
    contents?: string[];
  };
  assets: {
    path: string;
    exists: boolean;
  };
};
