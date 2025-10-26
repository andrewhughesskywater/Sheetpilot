// Development logger fallback for browser environment
// This provides a console-based logger when window.logger is not available (e.g., in Vite dev server)

interface Logger {
  error: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  verbose: (message: string, data?: unknown) => void;
  debug: (message: string, data?: unknown) => void;
  userAction: (action: string, data?: unknown) => void;
}

class DevelopmentLogger implements Logger {
  private formatMessage(level: string, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  error(message: string, data?: unknown): void {
    console.error(this.formatMessage('error', message, data));
  }

  warn(message: string, data?: unknown): void {
    console.warn(this.formatMessage('warn', message, data));
  }

  info(message: string, data?: unknown): void {
    console.info(this.formatMessage('info', message, data));
  }

  verbose(message: string, data?: unknown): void {
    console.log(this.formatMessage('verbose', message, data));
  }

  debug(message: string, data?: unknown): void {
    console.debug(this.formatMessage('debug', message, data));
  }

  userAction(action: string, data?: unknown): void {
    console.log(this.formatMessage('user-action', `User action: ${action}`, data));
  }
}

// Create fallback logger instance
const developmentLogger = new DevelopmentLogger();

// Export function to initialize logger fallback
export function initializeLoggerFallback(): void {
  // Check if we're in development mode and window.logger is not available
  const isDev = (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.DEV === true || 
                (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.MODE === 'development';
  
  if (isDev && !window.logger) {
    console.log('[LoggerFallback] Initializing development logger fallback');
    
    // Create a fallback logger that uses console methods
    window.logger = developmentLogger;
    
    console.log('[LoggerFallback] Development logger fallback initialized');
  }
}

// Export the logger instance for direct use if needed
export { developmentLogger };
