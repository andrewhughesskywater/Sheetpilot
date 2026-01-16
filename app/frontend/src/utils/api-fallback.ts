import { mockAuthAPI } from "./api-fallback.auth";
import { mockCredentialsAPI } from "./api-fallback.credentials";
import { mockDatabaseAPI } from "./api-fallback.database";
import { mockLogsAPI } from "./api-fallback.logs";
import { mockTimesheetAPI } from "./api-fallback.timesheet";

const isDevEnvironment = (): boolean =>
  (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.DEV ===
    true ||
  (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.MODE ===
    "development";

const ensureFallback = (
  win: Record<string, unknown>,
  key: string,
  api: unknown,
  logMessage: string
): void => {
  if (win[key]) {
    return;
  }
  win[key] = api;
  console.log(logMessage);
};

// Export function to initialize API fallbacks
export function initializeAPIFallback(): void {
  if (!isDevEnvironment()) {
    return;
  }

  console.log("[APIFallback] Initializing development API fallbacks");

  // Create fallback APIs if they don't exist
  const win = window as unknown as Record<string, unknown>;
  const fallbackEntries = [
    {
      key: "auth",
      api: mockAuthAPI,
      log: "[APIFallback] Mock auth API initialized",
    },
    {
      key: "timesheet",
      api: mockTimesheetAPI,
      log: "[APIFallback] Mock timesheet API initialized",
    },
    {
      key: "credentials",
      api: mockCredentialsAPI,
      log: "[APIFallback] Mock credentials API initialized",
    },
    {
      key: "database",
      api: mockDatabaseAPI,
      log: "[APIFallback] Mock database API initialized",
    },
    {
      key: "logs",
      api: mockLogsAPI,
      log: "[APIFallback] Mock logs API initialized",
    },
  ];

  fallbackEntries.forEach((entry) =>
    ensureFallback(win, entry.key, entry.api, entry.log)
  );

  console.log("[APIFallback] All development API fallbacks initialized");
}

// Export the mock APIs for direct use if needed
export {
  mockAuthAPI,
  mockTimesheetAPI,
  mockCredentialsAPI,
  mockDatabaseAPI,
  mockLogsAPI,
};
