export function logError(message: string, data?: unknown): void {
  window.logger?.error?.(message, data);
}

export function logWarn(message: string, data?: unknown): void {
  window.logger?.warn?.(message, data);
}

export function logInfo(message: string, data?: unknown): void {
  window.logger?.info?.(message, data);
}

export function logVerbose(message: string, data?: unknown): void {
  window.logger?.verbose?.(message, data);
}

export function logDebug(message: string, data?: unknown): void {
  window.logger?.debug?.(message, data);
}

export function logUserAction(action: string, data?: unknown): void {
  window.logger?.userAction?.(action, data);
}
