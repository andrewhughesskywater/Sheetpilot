/**
 * Compatibility re-export for automation configuration.
 *
 * The bot implementation moved config to `src/config/automation_config.ts`,
 * but external callers (and tests) import from `src/automation_config`.
 */
export * from './config/automation_config';

