import type { LoggerLike } from "./logger-contract";

export interface LoggingModule {
  initializeLogging: () => void;
  appLogger: LoggerLike;
  dbLogger: LoggerLike;
}

export async function loadLoggingModule(shim: {
  appLogger: LoggerLike;
  dbLogger: LoggerLike;
}): Promise<LoggingModule> {
  // In test mode, use placeholder loggers that will be mocked
  if (process.env["VITEST"] === "true") {
    const mockLogger = (): LoggerLike => ({
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      verbose: () => {},
      silly: () => {},
      audit: () => {},
      security: () => {},
      startTimer: () => ({ done: () => {} }),
    });
    return {
      initializeLogging: () => {},
      appLogger: mockLogger(),
      dbLogger: mockLogger(),
    };
  }

  try {
    const mod = (await import("@sheetpilot/shared/logger")) as {
      initializeLogging?: unknown;
      appLogger?: unknown;
      dbLogger?: unknown;
    };

    if (typeof mod.initializeLogging !== "function") {
      return {
        initializeLogging: () => {},
        appLogger: shim.appLogger,
        dbLogger: shim.dbLogger,
      };
    }

    return {
      initializeLogging: mod.initializeLogging as () => void,
      appLogger: (mod.appLogger as LoggerLike) ?? shim.appLogger,
      dbLogger: (mod.dbLogger as LoggerLike) ?? shim.dbLogger,
    };
  } catch {
    // Keep shim loggers if shared logger cannot load for any reason
    return {
      initializeLogging: () => {},
      appLogger: shim.appLogger,
      dbLogger: shim.dbLogger,
    };
  }
}
