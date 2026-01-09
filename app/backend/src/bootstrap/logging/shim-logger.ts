import type { LoggerLike } from './logger-contract';

export function createShimLogger(component: string): LoggerLike {
  const prefix = `[${component}]`;
  return {
    error: (message: string, data?: unknown) => console.error(prefix, message, data ?? ''),
    warn: (message: string, data?: unknown) => console.warn(prefix, message, data ?? ''),
    info: (message: string, data?: unknown) => console.log(prefix, message, data ?? ''),
    verbose: (message: string, data?: unknown) => console.log(prefix, message, data ?? ''),
    debug: (message: string, data?: unknown) => console.debug(prefix, message, data ?? ''),
    silly: (message: string, data?: unknown) => console.debug(prefix, message, data ?? ''),
    audit: (_action: string, message: string, data?: unknown) => console.log(prefix, message, data ?? ''),
    security: (_eventType: string, message: string, data?: unknown) => console.warn(prefix, message, data ?? ''),
    startTimer: (_operation: string) => ({ done: (_metadata?: unknown) => void 0 }),
  };
}
