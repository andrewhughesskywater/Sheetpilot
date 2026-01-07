/**
 * Sentry error tracking initialization for Electron main process.
 *
 * Configured with:
 * - Development: 100% sample rate (capture all errors for testing)
 * - Production: 5% sample rate (avoid quota bloat while catching startup errors)
 * - Disabled for smoke tests and packaged debug builds
 *
 * Sets up error capturing for:
 * - Startup failures (window creation, preload, IPC registration)
 * - Renderer process crashes (captured via show-error-dialog)
 * - Uncaught exceptions and unhandled promise rejections
 */

import type { LoggerLike } from '../logging/logger-contract';

/**
 * Initialize Sentry with environment-aware sampling.
 *
 * @param isDev - Development mode flag
 * @param isSmoke - Smoke test mode flag (Sentry disabled)
 * @param isPackaged - App is packaged (production build)
 * @param logger - Logger instance for tracking initialization
 */
export function initializeSentry(
  isDev: boolean,
  isSmoke: boolean,
  isPackaged: boolean,
  logger: LoggerLike
): void {
  // Disable Sentry for smoke tests and debug builds
  if (isSmoke || (isPackaged && process.env['NODE_ENV'] !== 'production')) {
    logger.verbose('Sentry disabled (smoke test or debug build)');
    return;
  }

  const dsn = process.env['SENTRY_DSN'] || '';

  if (!dsn) {
    logger.verbose('Sentry disabled (no DSN configured)');
    return;
  }

  try {
    // Dynamic import to avoid hard dependency on @sentry/electron
     
    const Sentry = require('@sentry/electron');

    const tracesSampleRate = isDev ? 1.0 : 0.05;

    Sentry.init({
      dsn,
      environment: isDev ? 'development' : 'production',
      tracesSampleRate,
      // Exclude internal renderer/preload frames from error tracking
      denyUrls: [
        // Filter out React/Vite internal errors
        /react/i,
        /webpack/i,
        /vite/i,
        // Filter out chrome extensions
        /extensions\//i,
        // Filter out inline scripts
        /<anonymous>/i
      ],
      // Capture breadcrumbs for startup sequence
      integrations: (integrations: Array<{ name: string }>) => {
        return integrations.filter((integration: { name: string }) => {
          // Remove integrations that don't make sense in Electron main process
          const name = integration.name;
          return ![
            'Breadcrumbs',
            'GlobalHandlers',
            'TryCatch',
            'Replay',
            'SessionReplay'
          ].includes(name);
        });
      }
    });

    // Attach Sentry to globalThis for access in error handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Sentry = Sentry;

    logger.info('Sentry initialized', {
      environment: isDev ? 'development' : 'production',
      tracesSampleRate,
      dsnConfigured: Boolean(dsn)
    });
  } catch (err: unknown) {
    logger.warn('Could not initialize Sentry', {
      error: err instanceof Error ? err.message : String(err)
    });
  }
}
