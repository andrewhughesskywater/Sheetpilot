/**
 * Compatibility re-export for automation configuration.
 *
 * The bot implementation stores config in `src/config/automation_config.ts`,
 * but external callers (and tests) historically import from `src/automation_config`.
 *
 * Prefer importing config from the `src/config/` path when you work inside this
 * package. Keep using this module only to avoid breaking existing consumers.
 */
export * from './config/automation_config';

