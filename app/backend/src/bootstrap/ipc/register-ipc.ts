import type { BrowserWindow } from "electron";
import type { LoggerLike } from "@/bootstrap/logging/logger-contract";
import { registerAllIPCHandlers, setMainWindow } from "@/routes/index";

let ipcModuleLoaded = false;

export function registerIpcHandlers(params: {
  logger: LoggerLike;
  backendDirname: string;
}): void {
  params.logger.verbose("Loading IPC handlers module", {
    path: "./routes/index",
  });

  try {
    params.logger.verbose("IPC handlers module loaded successfully");
    registerAllIPCHandlers(null); // set mainWindow reference after window creation
    ipcModuleLoaded = true;
    params.logger.info("All IPC handlers registered successfully");
  } catch (err: unknown) {
    const errorData: {
      error: string;
      stack?: string | undefined;
    } = {
      error: err instanceof Error ? err.message : String(err),
    };

    if (err instanceof Error && err.stack !== undefined) {
      errorData.stack = err.stack;
    }

    params.logger.error("Could not register IPC handlers", errorData);
    throw err;
  }
}

export function setIpcMainWindow(
  mainWindow: BrowserWindow | null,
  logger: LoggerLike
): void {
  if (!ipcModuleLoaded) {
    logger.warn("Could not set IPC main window reference", {
      reason: "IPC module not loaded",
    });
    return;
  }
  setMainWindow(mainWindow);
  logger.verbose("MainWindow reference updated successfully");
}
