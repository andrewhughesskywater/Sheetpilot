# Error Handling Guide

**Last Updated**: October 2025  
**Version**: 1.0.0

## Overview

SheetPilot uses structured error handling with domain-specific error classes to improve error tracking, logging, and debugging. All errors follow ISO9000 and SOC2 compliance standards.

## Error Architecture

### Base Error Class

All errors extend `AppError` with these properties:

- **code**: Programmatic error identifier (e.g., `DB_CONNECTION_ERROR`)
- **message**: Human-readable error message
- **category**: Error category for filtering/monitoring
- **context**: Additional structured data
- **timestamp**: ISO 8601 timestamp

```typescript
abstract class AppError extends Error {
    readonly code: string;
    readonly context: Record<string, unknown>;
    readonly timestamp: string;
    readonly category: ErrorCategory;
}
```

## Error Categories

Errors are organized into categories for better management:

| Category | Use Case |
|----------|----------|
| `database` | Database connection, query, transaction errors |
| `credentials` | Credential storage, retrieval, authentication |
| `submission` | Timesheet submission failures |
| `validation` | Input validation errors |
| `network` | Network connectivity issues |
| `ipc` | Inter-process communication errors |
| `configuration` | Configuration/setup errors |
| `business_logic` | Business rule violations |
| `system` | System-level errors |

## Usage Examples

### 1. Throwing Domain Errors

```typescript
import { CredentialsNotFoundError, DatabaseQueryError } from '../../shared/errors';

// Before
if (!credentials) {
  throw new Error('Credentials not found');
}

// After
if (!credentials) {
  throw new CredentialsNotFoundError('smartsheet', {
    email: userEmail,
    action: 'retrieve'
  });
}
```

### 2. Catching and Handling Errors

```typescript
import { isAppError, createUserFriendlyMessage, extractErrorCode } from '../../shared/errors';

try {
  const result = await submitTimesheet();
} catch (err: unknown) {
  // Check if it's our structured error
  if (isAppError(err)) {
    logger.error('Operation failed', {
      code: err.code,
      category: err.category,
      context: err.context
    });
    
    // Return user-friendly message
    return { error: err.toUserMessage() };
  }
  
  // Handle unknown errors
  const errorMessage = createUserFriendlyMessage(err);
  return { error: errorMessage };
}
```

### 3. Error Handling in IPC Handlers

```typescript
ipcMain.handle('credentials:store', async (_event, service: string, email: string, password: string) => {
  try {
    return storeCredentials(service, email, password);
  } catch (err: unknown) {
    // Log with structured details
    if (isAppError(err)) {
      ipcLogger.security('credentials-storage-error', 'Could not store credentials', {
        code: err.code,
        service,
        context: err.context
      });
      return { success: false, error: err.toUserMessage() };
    }
    
    // Fallback for unknown errors
    return { success: false, error: 'Unknown error occurred' };
  }
});
```

### 4. Error Categories for Filtering

```typescript
import { isCredentialsError, isDatabaseError, isRetryableError } from '../../shared/errors';

catch (error: unknown) {
  if (isCredentialsError(error)) {
    // Security-related error - escalate
    securityLogger.error('Security issue', error);
  }
  
  if (isDatabaseError(error) && isRetryableError(error)) {
    // Retry database operations
    await retryOperation();
  }
  
  if (isDatabaseError(error) && !isRetryableError(error)) {
    // Fatal database error - alert admin
    alertAdmin(error);
  }
}
```

## Error Class Reference

### Database Errors

```typescript
DatabaseConnectionError    // Connection failed
DatabaseQueryError         // Query execution failed
DatabaseSchemaError        // Schema initialization failed
DatabaseTransactionError   // Transaction rollback
```

### Credentials Errors

```typescript
CredentialsNotFoundError      // Credentials not found
CredentialsStorageError       // Failed to store credentials
CredentialsRetrievalError     // Failed to retrieve credentials
InvalidCredentialsError       // Invalid credentials provided
```

### Submission Errors

```typescript
SubmissionServiceUnavailableError  // Service unavailable
SubmissionFailedError               // Submission failed
NoEntriesToSubmitError              // No entries to submit
```

### Validation Errors

```typescript
InvalidDateError          // Invalid date format
InvalidTimeError          // Invalid time format
RequiredFieldError        // Required field missing
InvalidFieldValueError    // Invalid field value
```

## Utility Functions

### Error Extraction

```typescript
extractErrorMessage(error)      // Get error message
extractErrorCode(error)         // Get error code
extractErrorContext(error)      // Get error context
```

### Error Checking

```typescript
isAppError(error)               // Check if AppError
isDatabaseError(error)          // Check if DatabaseError
isCredentialsError(error)       // Check if CredentialsError
isRetryableError(error)         // Check if error is retryable
isSecurityError(error)          // Check if security concern
```

### User-Friendly Messages

```typescript
createUserFriendlyMessage(error)  // Create user-friendly message
```

## Best Practices

### 1. Always Provide Context

```typescript
// ❌ Bad
throw new DatabaseQueryError('INSERT failed');

// ✅ Good
throw new DatabaseQueryError('insert-timesheet-entry', {
  table: 'timesheet',
  rowCount: 10,
  dbPath: getDbPath()
});
```

### 2. Use Appropriate Error Types

```typescript
// ❌ Bad
throw new Error('Database error');

// ✅ Good
throw new DatabaseConnectionError({
  dbPath: DB_PATH,
  error: err.message
});
```

### 3. Log with Structure

```typescript
// ❌ Bad
logger.error('Operation failed', err.message);

// ✅ Good
if (isAppError(err)) {
  logger.error('Operation failed', {
    code: err.code,
    category: err.category,
    context: err.context
  });
}
```

### 4. Handle Security Errors Appropriately

```typescript
catch (error: unknown) {
  if (isCredentialsError(error)) {
    // SOC2: Track security events
    logger.security('credentials-access-error', 'Could not access credentials', {
      code: error.code,
      context: error.context
    });
  }
}
```

### 5. Provide User-Friendly Messages

```typescript
// Return technical details to logs, user-friendly messages to UI
const userMessage = createUserFriendlyMessage(error);
logger.error('Technical error details', {
  code: extractErrorCode(error),
  context: extractErrorContext(error)
});
return { error: userMessage };  // Return to user
```

## Migration Guide

### From Generic Error Handling

**Before:**
```typescript
try {
  const result = someOperation();
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { error: message };
}
```

**After:**
```typescript
import { createUserFriendlyMessage, extractErrorCode, isAppError } from '../../shared/errors';

try {
  const result = someOperation();
} catch (err: unknown) {
  const code = extractErrorCode(err);
  const message = createUserFriendlyMessage(err);
  
  if (isAppError(err)) {
    logger.error('Operation failed', {
      code: err.code,
      category: err.category,
      context: err.context
    });
  }
  
  return { error: message, code };
}
```

## ISO9000/SOC2 Compliance

### Error Tracking

All errors include:
- ISO 8601 timestamp for audit trail
- Error code for programmatic handling
- Context for debugging
- Category for filtering

### Security Event Logging

Security-related errors (credentials) are logged with special handling:

```typescript
if (isCredentialsError(error)) {
  logger.security('credentials-access-violation', message, context);
}
```

### Audit Trail

All error logging maintains audit trail:

```typescript
logger.audit('operation-error', message, {
  code: error.code,
  category: error.category,
  context: error.context,
  timestamp: error.timestamp
});
```

## Testing Error Handling

### Unit Tests

```typescript
import { CredentialsNotFoundError } from '../../shared/errors';

test('should throw CredentialsNotFoundError when credentials missing', () => {
  expect(() => getCredentials('nonexistent')).toThrow(CredentialsNotFoundError);
});

test('error should contain proper code and context', () => {
  const error = new CredentialsNotFoundError('smartsheet', { action: 'get' });
  expect(error.code).toBe('CRED_NOT_FOUND');
  expect(error.category).toBe(ErrorCategory.CREDENTIALS);
  expect(error.context.service).toBe('smartsheet');
});
```

## Summary

- ✅ Domain-specific error classes
- ✅ Structured error context
- ✅ ISO9000/SOC2 compliant tracking
- ✅ User-friendly error messages
- ✅ Programmatic error handling
- ✅ Security event logging
- ✅ Retry logic support
- ✅ Type-safe error handling

