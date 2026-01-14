import { AppError, ErrorCategory } from './base';

// ============================================================================
// NETWORK ERRORS
// ============================================================================

export class NetworkError extends AppError {
  constructor(message: string = 'Could not complete network operation', context: Record<string, unknown> = {}) {
    super(message, 'NETWORK_ERROR', ErrorCategory.NETWORK, context);
  }
}

// ============================================================================
// CONFIGURATION ERRORS
// ============================================================================

export class ConfigurationError extends AppError {
  constructor(message: string = 'Configuration invalid', context: Record<string, unknown> = {}) {
    super(message, 'CONFIGURATION_ERROR', ErrorCategory.CONFIGURATION, context);
  }
}

// ============================================================================
// BUSINESS LOGIC ERRORS
// ============================================================================

export class BusinessLogicError extends AppError {
  constructor(message: string = 'Business rule violated', context: Record<string, unknown> = {}) {
    super(message, 'BUSINESS_LOGIC_ERROR', ErrorCategory.BUSINESS_LOGIC, context);
  }
}

// ============================================================================
// SYSTEM ERRORS
// ============================================================================

export class SystemError extends AppError {
  constructor(message: string = 'Could not complete system operation', context: Record<string, unknown> = {}) {
    super(message, 'SYSTEM_ERROR', ErrorCategory.SYSTEM, context);
  }
}
