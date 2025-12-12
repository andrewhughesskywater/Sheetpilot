import * as path from 'path';
import type { App } from 'electron';
import type { LoggerLike } from '../logging/logger-contract';
import { ensureSchema, getDb, getDbPath, runMigrations, setDbPath } from '../../repositories';

export function bootstrapDatabase(app: App, logger: LoggerLike): void {
  const timer = logger.startTimer('bootstrap-database');
  const dbFile = path.join(app.getPath('userData'), 'sheetpilot.sqlite');
  logger.verbose('Setting database path', { dbFile });
  setDbPath(dbFile);

  // Run migrations before ensuring schema (handles version tracking and backups)
  logger.verbose('Running database migrations if needed');
  const migrationResult = runMigrations(getDb(), getDbPath());
  if (!migrationResult.success) {
    logger.error('Database migration failed', {
      error: migrationResult.error,
      backupPath: migrationResult.backupPath
    });
    // Continue anyway - ensureSchema will handle basic table creation
  } else if (migrationResult.migrationsRun > 0) {
    logger.info('Database migrations completed', {
      fromVersion: migrationResult.fromVersion,
      toVersion: migrationResult.toVersion,
      migrationsRun: migrationResult.migrationsRun,
      backupPath: migrationResult.backupPath
    });
  }

  logger.verbose('Ensuring database schema exists');
  ensureSchema();
  logger.info('Database initialized successfully', { dbPath: getDbPath() });
  timer.done();
}


