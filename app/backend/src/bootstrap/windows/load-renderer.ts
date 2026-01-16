import * as fs from "fs";
import * as path from "path";
import type { App, BrowserWindow } from "electron";
import { dialog } from "electron";
import type { LoggerLike } from "@/bootstrap/logging/logger-contract";

type FileStats = {
  size?: number;
  readable?: boolean;
  error?: string;
  assetReferences?: string[];
};

type UnpackedDirInfo = { exists?: boolean; contents?: string[] };

const readHtmlContentStats = (absoluteHtmlPath: string): FileStats => {
  try {
    const content = fs.readFileSync(absoluteHtmlPath, {
      encoding: "utf8",
      flag: "r",
    });
    const assetReferences = content.match(/src="([^"]+)"/g) || [];
    return {
      readable: true,
      assetReferences: assetReferences.slice(0, 5),
    };
  } catch (readErr: unknown) {
    return {
      readable: false,
      error: readErr instanceof Error ? readErr.message : String(readErr),
    };
  }
};

const inspectHtmlFile = (
  absoluteHtmlPath: string
): { fileExists: boolean; fileStats: FileStats } => {
  if (!fs.existsSync(absoluteHtmlPath)) {
    return { fileExists: false, fileStats: {} };
  }

  try {
    const stats = fs.statSync(absoluteHtmlPath);
    const contentStats = readHtmlContentStats(absoluteHtmlPath);
    return {
      fileExists: true,
      fileStats: { size: stats.size, ...contentStats },
    };
  } catch (statErr: unknown) {
    return {
      fileExists: true,
      fileStats: {
        error: statErr instanceof Error ? statErr.message : String(statErr),
      },
    };
  }
};

const readDirSafe = (dirPath: string): string[] => {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
};

const getUnpackedDirInfo = (
  packagedLike: boolean
): { unpackedDir: string | null; unpackedDirInfo: UnpackedDirInfo } => {
  if (!packagedLike) {
    return { unpackedDir: null, unpackedDirInfo: {} };
  }

  const unpackedDir = path.join(process.resourcesPath, "app.asar.unpacked");
  if (!fs.existsSync(unpackedDir)) {
    return { unpackedDir, unpackedDirInfo: {} };
  }

  return {
    unpackedDir,
    unpackedDirInfo: { exists: true, contents: readDirSafe(unpackedDir) },
  };
};

const handleMissingHtmlFile = (
  app: App,
  logger: LoggerLike,
  htmlPath: string,
  absoluteHtmlPath: string,
  backendDirname: string,
  unpackedDirInfo: UnpackedDirInfo
): void => {
  const errorMsg = `Frontend HTML file not found at: ${absoluteHtmlPath}\nRelative path: ${htmlPath}\nbackendDirname: ${backendDirname}\nresourcesPath: ${process.resourcesPath}\nisPackaged: ${app.isPackaged}\nUnpacked dir exists: ${unpackedDirInfo.exists}\nPlease rebuild the application.`;
  logger.error("Frontend HTML file not found", {
    htmlPath,
    absoluteHtmlPath,
    backendDirname,
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged,
    unpackedDirInfo,
  });
  dialog.showErrorBox("Application Startup Error", errorMsg);
  app.exit(1);
};

const handleUnreadableHtmlFile = (
  app: App,
  logger: LoggerLike,
  htmlPath: string,
  absoluteHtmlPath: string,
  fileStats: FileStats
): void => {
  const errorMsg = `Frontend HTML file exists but cannot be read: ${absoluteHtmlPath}\nError: ${fileStats.error}\nPlease check file permissions.`;
  logger.error("Frontend HTML file not readable", {
    htmlPath,
    absoluteHtmlPath,
    fileStats,
  });
  dialog.showErrorBox("Application Startup Error", errorMsg);
  app.exit(1);
};

const handleMissingAssetsDir = (
  app: App,
  logger: LoggerLike,
  assetsDir: string,
  htmlPath: string
): void => {
  logger.error("Assets directory not found", { assetsDir, htmlPath });
  dialog.showErrorBox(
    "Application Startup Error",
    `Frontend assets directory not found at: ${assetsDir}\n\nThe HTML file exists but its assets are missing.\n\nPlease rebuild the application.`
  );
  app.exit(1);
};

const setSplashHash = (window: BrowserWindow, logger: LoggerLike): void => {
  setTimeout(() => {
    if (!window.isDestroyed()) {
      window.webContents
        .executeJavaScript('window.location.hash = "splash";')
        .catch((err: unknown) => {
          logger.debug("Could not set splash hash", {
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }
  }, 100);
};

const handleLoadFileError = (
  app: App,
  logger: LoggerLike,
  htmlPath: string,
  absoluteHtmlPath: string,
  assetsDir: string,
  assetsDirExists: boolean,
  err: unknown
): void => {
  logger.error("loadFile promise rejected", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    htmlPath,
    absoluteHtmlPath,
    appPath: app.getAppPath(),
    assetsDir,
    assetsDirExists,
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  });

  try {
    dialog.showErrorBox(
      "Failed to Load Application",
      `Could not load the application interface:\n\nError: ${err instanceof Error ? err.message : String(err)}\n\nRelative Path: ${htmlPath}\n\nAbsolute Path: ${absoluteHtmlPath}\n\nApp Path: ${app.getAppPath()}\n\nAssets dir: ${assetsDir} (exists: ${assetsDirExists})\n\nPlease check the log file for more details.`
    );
  } catch (dialogErr: unknown) {
    logger.error("Could not show error dialog", {
      error: dialogErr instanceof Error ? dialogErr.message : String(dialogErr),
    });
  }
};

const ensureWindowShown = (
  window: BrowserWindow,
  logger: LoggerLike
): void => {
  setTimeout(() => {
    if (!window.isDestroyed() && !window.isVisible()) {
      logger.warn("Window not shown after timeout, forcing show", {
        isVisible: window.isVisible(),
        readyToShow: false,
      });
      window.show();
    }
  }, 5000);
};

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
    params.logger.verbose("Loading development URL with splash", {
      url: "http://localhost:5173#splash",
    });
    await params.window.loadURL("http://localhost:5173#splash");
    return;
  }

  const htmlPath = "app/frontend/dist/index.html";
  params.logger.verbose(
    "Using relative path with loadFile for ASAR path resolution",
    {
      htmlPath,
      appPath: params.app.getAppPath(),
      backendDirname: params.backendDirname,
      resourcesPath: process.resourcesPath,
      isPackaged: params.app.isPackaged,
    }
  );

  const absoluteHtmlPath = path.join(params.app.getAppPath(), htmlPath);
  const { fileExists, fileStats } = inspectHtmlFile(absoluteHtmlPath);
  const { unpackedDir, unpackedDirInfo } = getUnpackedDirInfo(
    params.packagedLike
  );

  params.logger.verbose("Loading production HTML with splash", {
    htmlPath,
    absoluteHtmlPath,
    fileExists,
    fileStats,
    unpackedDir,
    unpackedDirInfo,
    backendDirname: params.backendDirname,
    isPackaged: params.app.isPackaged,
    resourcesPath: process.resourcesPath,
  });

  if (!fileExists) {
    handleMissingHtmlFile(
      params.app,
      params.logger,
      htmlPath,
      absoluteHtmlPath,
      params.backendDirname,
      unpackedDirInfo
    );
    return;
  }

  if (fileStats.readable === false) {
    handleUnreadableHtmlFile(
      params.app,
      params.logger,
      htmlPath,
      absoluteHtmlPath,
      fileStats
    );
    return;
  }

  const assetsDir = path.join(path.dirname(absoluteHtmlPath), "assets");
  const assetsDirExists = fs.existsSync(assetsDir);
  params.logger.verbose("Checking assets directory", {
    assetsDir,
    assetsDirExists,
  });

  if (!assetsDirExists) {
    handleMissingAssetsDir(params.app, params.logger, assetsDir, htmlPath);
    return;
  }

  params.logger.verbose("Loading HTML with loadFile (relative path)", {
    htmlPath,
    absoluteHtmlPath,
    assetsDir,
  });

  try {
    await params.window.loadFile(htmlPath);
    params.logger.info("loadFile promise resolved successfully");
    setSplashHash(params.window, params.logger);
  } catch (err: unknown) {
    handleLoadFileError(
      params.app,
      params.logger,
      htmlPath,
      absoluteHtmlPath,
      assetsDir,
      assetsDirExists,
      err
    );
  }

  // Add timeout to show window even if ready-to-show doesn't fire
  ensureWindowShown(params.window, params.logger);
}
