import * as fs from "fs";
import * as path from "path";
import type { App, BrowserWindow } from "electron";
import { BrowserWindow as ElectronBrowserWindow, dialog } from "electron";
import type { LoggerLike } from "@/bootstrap/logging/logger-contract";
import type { WindowState } from "./window-state";

export function createMainWindow(params: {
  app: App;
  logger: LoggerLike;
  packagedLike: boolean;
  isSmoke: boolean;
  backendDirname: string;
  windowState: WindowState;
  scheduleWindowStateSave: () => void;
  restoreWindowStateAsync: (window: BrowserWindow) => Promise<void>;
}): BrowserWindow | null {
  const iconPath = params.packagedLike
    ? undefined
    : path.join(
        params.backendDirname,
        "..",
        "..",
        "..",
        "..",
        "app",
        "frontend",
        "src",
        "assets",
        "images",
        "icon.ico"
      );

  const preloadPath = path.join(params.backendDirname, "preload.js");
  if (!fs.existsSync(preloadPath)) {
    const errorMsg = `Preload script not found at: ${preloadPath}\nbackendDirname: ${params.backendDirname}\nPlease rebuild the application.`;
    params.logger.error("Preload script not found", {
      preloadPath,
      backendDirname: params.backendDirname,
    });
    dialog.showErrorBox("Application Startup Error", errorMsg);
    params.app.exit(1);
    return null;
  }

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: params.windowState.width,
    height: params.windowState.height,
    show: false,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  };

  if (params.windowState.x !== undefined) {
    windowOptions.x = params.windowState.x;
  }
  if (params.windowState.y !== undefined) {
    windowOptions.y = params.windowState.y;
  }

  const window = new ElectronBrowserWindow(windowOptions);

  window.webContents.setWindowOpenHandler(({ url }) => {
    params.logger.warn("Blocked window.open request", { url });
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    try {
      const parsed = new URL(url);
      const protocol = parsed.protocol;
      const isFile = protocol === "file:";
      const isDevLocalhost =
        protocol === "http:" &&
        parsed.hostname === "localhost" &&
        parsed.port === "5173";

      if (!isFile && !isDevLocalhost) {
        params.logger.warn("Blocked navigation attempt", { url });
        event.preventDefault();
      }
    } catch (err: unknown) {
      params.logger.warn("Could not parse navigation URL", {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
      event.preventDefault();
    }
  });

  window.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      params.logger.warn("Denied permission request", { permission });
      callback(false);
    }
  );

  window.webContents.on(
    "console-message",
    (_e, level, message, line, sourceId) => {
      const data = { line, sourceId };
      switch (level) {
        case 0:
          params.logger.debug(`[Renderer] ${message}`, data);
          break;
        case 1:
          params.logger.info(`[Renderer] ${message}`, data);
          break;
        case 2:
          params.logger.warn(`[Renderer] ${message}`, data);
          break;
        case 3:
          params.logger.error(`[Renderer] ${message}`, data);
          break;
        default:
          params.logger.info(`[Renderer] ${message}`, data);
      }
    }
  );

  if (params.isSmoke) {
    try {
      window.webContents.openDevTools({ mode: "detach" });
    } catch {
      // no-op
    }
  }

  if (params.windowState.isMaximized) {
    window.maximize();
  }

  window.once("ready-to-show", () => {
    params.logger.info("Window ready-to-show event fired");
    window.show();
    params.logger.info("Main window shown", {
      width: params.windowState.width,
      height: params.windowState.height,
      isVisible: window.isVisible(),
      isDestroyed: window.isDestroyed(),
    });

    params.restoreWindowStateAsync(window).catch((err: unknown) => {
      params.logger.debug("Could not restore window state", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });

  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      params.logger.error("Could not load renderer", {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
        webContentsId: window.webContents.id,
      });

      if (isMainFrame) {
        try {
          dialog.showErrorBox(
            "Failed to Load Application",
            `Could not load the application interface:\n\nError ${errorCode}: ${errorDescription}\n\nURL: ${validatedURL}\n\nPlease check the log file for more details.`
          );
        } catch (err: unknown) {
          params.logger.error("Could not show error dialog", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  );

  window.webContents.on("did-finish-load", () => {
    if (!window.isDestroyed()) {
      params.logger.info("Renderer loaded successfully", {
        url: window.webContents.getURL(),
        title: window.webContents.getTitle(),
      });
    } else {
      params.logger.info(
        "Renderer loaded successfully (window already destroyed)"
      );
    }
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    params.logger.error("Renderer process crashed", {
      reason: details.reason,
      exitCode: details.exitCode,
    });

    try {
      dialog.showErrorBox(
        "Renderer Process Crashed",
        `The application interface crashed:\n\nReason: ${details.reason}\nExit Code: ${details.exitCode}\n\nThe application will now exit.`
      );
      setTimeout(() => params.app.exit(1), 2000);
    } catch (err: unknown) {
      params.logger.error("Could not show error dialog", {
        error: err instanceof Error ? err.message : String(err),
      });
      params.app.exit(1);
    }
  });

  window.on("show", () => {
    if (!window.isDestroyed()) {
      params.logger.info("Window show event fired", {
        isVisible: window.isVisible(),
        isFocused: window.isFocused(),
      });
    }
  });

  window.on("resize", () => {
    if (!window.isMaximized()) {
      params.scheduleWindowStateSave();
    }
  });

  window.on("move", () => {
    if (!window.isMaximized()) {
      params.scheduleWindowStateSave();
    }
  });

  window.on("maximize", () => {
    params.scheduleWindowStateSave();
  });

  window.on("unmaximize", () => {
    params.scheduleWindowStateSave();
  });

  window.on("close", () => {
    params.scheduleWindowStateSave();
  });

  return window;
}
