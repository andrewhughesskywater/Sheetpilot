// Public services surface for backend

// Timesheet submission/import APIs
export { getEntriesByIds,getPendingEntries, submitTimesheets } from './timesheet-importer';
export type { SubmissionResult } from '@sheetpilot/shared';

// Plugin implementations (credential/data/submission)
export { ElectronBotService } from './plugins/electron-bot-service';
export { MemoryDataService } from './plugins/memory-data-service';
export { MockSubmissionService } from './plugins/mock-submission-service';
export { PlaywrightBotService } from './plugins/playwright-bot-service';
export { SQLiteCredentialService } from './plugins/sqlite-credential-service';
export { SQLiteDataService } from './plugins/sqlite-data-service';
