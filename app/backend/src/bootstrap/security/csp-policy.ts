/**
 * Content Security Policy configuration for Electron windows.
 * Provides typed, auditable CSP directives for both development and production.
 *
 * Security Notes:
 * - Production: Strict policy with no unsafe-inline for scripts
 * - Development: Permissive for Vite HMR, debuggers, and eval
 * - style-src: unsafe-inline required for Material Design 3 token injection
 */

export interface CspDirective {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'object-src': string[];
  'base-uri': string[];
  'form-action': string[];
  'frame-ancestors': string[];
  'upgrade-insecure-requests'?: boolean;
}

export interface CspPolicy {
  directives: CspDirective;
  isDev: boolean;
}

/**
 * Build CSP header value from directive map.
 * Converts typed directives object to HTTP header string.
 */
export function buildCspHeader(policy: CspPolicy): string {
  const lines: string[] = [];

   
  const { 'upgrade-insecure-requests': _upgrade, ...directives } = policy.directives;

  for (const [key, values] of Object.entries(directives)) {
    if (Array.isArray(values) && values.length > 0) {
      lines.push(`${key} ${values.join(' ')}`);
    }
  }

  if (policy.directives['upgrade-insecure-requests']) {
    lines.push('upgrade-insecure-requests');
  }

  return lines.join('; ');
}

/**
 * Create production CSP policy.
 * Strict: no unsafe-inline for scripts, only bundled code.
 */
export function createProductionCspPolicy(): CspPolicy {
  return {
    isDev: false,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"], // No unsafe-inline - all scripts must be bundled
      'style-src': ["'self'", "'unsafe-inline'"], // unsafe-inline needed for Material Design token injection
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': true
    }
  };
}

/**
 * Create development CSP policy.
 * Permissive: allows Vite HMR (ws/wss), eval, and unsafe-inline for development debugging.
 * Restricts to localhost:5173 for Vite dev server.
 */
export function createDevelopmentCspPolicy(): CspPolicy {
  return {
    isDev: true,
    directives: {
      'default-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'ws:', 'wss:'],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'", 'ws://localhost:*', 'wss://localhost:*'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"]
    }
  };
}

/**
 * Resolve CSP policy based on environment.
 */
export function resolveCspPolicy(isDev: boolean): CspPolicy {
  return isDev ? createDevelopmentCspPolicy() : createProductionCspPolicy();
}
