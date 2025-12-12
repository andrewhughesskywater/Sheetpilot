export interface LoggerLike {
  error: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  verbose: (message: string, data?: unknown) => void;
  debug: (message: string, data?: unknown) => void;
  silly: (message: string, data?: unknown) => void;
  audit: (action: string, message: string, data?: unknown) => void;
  security: (eventType: string, message: string, data?: unknown) => void;
  startTimer: (operation: string) => { done: (metadata?: unknown) => void };
}


