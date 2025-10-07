# Logging Language Standards

## Industry Best Practices Implementation

This document outlines the logging language standards implemented in SheetPilot to align with industry best practices for log messages.

## Core Principles

### 1. **Active Voice**

- ✅ Use: "Could not connect to database"
- ❌ Avoid: "Connection failed"
- **Reason**: Active voice is clearer and more direct

### 2. **Consistent Tense Usage**

#### Present Tense for States

Use present tense when describing current conditions or states:

- ✅ "Database unavailable"
- ✅ "Credentials not found"
- ✅ "Update available"

#### Past Tense for Completed Actions

Use past tense for actions that have completed:

- ✅ "Database initialized successfully"
- ✅ "Credentials stored successfully"
- ✅ "Window state persisted on close"

#### Present Continuous for Ongoing Actions

Use present continuous (-ing form) for actions in progress:

- ✅ "Checking for updates"
- ✅ "Connecting to database"
- ✅ "Submitting timesheet"

### 3. **Specific Error Verbs**

Always use specific, actionable verbs for errors:

| ❌ Avoid | ✅ Use Instead |
|---------|---------------|
| "Failed to load" | "Could not load" |
| "Failed to save" | "Could not save" |
| "Failed to connect" | "Could not connect" |
| "Error occurred" | "Encountered error" |
| "Was detected" | "Occurred" |

### 4. **Clarity and Specificity**

Be specific about what happened:

- ❌ "AutoUpdater error"
- ✅ "AutoUpdater encountered error"

- ❌ "Submission failed"
- ✅ "Could not submit timesheet"

### 5. **Avoid Passive Constructions**

| ❌ Passive Voice | ✅ Active Voice |
|-----------------|----------------|
| "Request was rejected" | "Server rejected request" |
| "File was deleted" | "User deleted file" |
| "Rejection was handled" | "Application handled rejection" |
| "Error was detected" | "Error occurred" |

## Applied Changes

### Error Messages

All error messages have been updated from "Failed to..." to "Could not...":

**Before:**

```typescript
logger.error('Failed to load credentials');
logger.error('Failed to save window state');
logger.error('Failed to export CSV');
```

**After:**

```typescript
logger.error('Could not load credentials');
logger.error('Could not save window state');
logger.error('Could not export CSV');
```

### State Messages

State messages use present tense:

```typescript
logger.warn('Credentials not found for submission');
logger.info('Update available');
logger.info('Database unavailable');
```

### Success Messages

Completed actions use past tense:

```typescript
logger.info('Database initialized successfully');
logger.info('Credentials stored successfully');
logger.info('Draft timesheet entries loaded');
```

### Ongoing Actions

Active processes use present continuous:

```typescript
logger.info('Checking for updates');
logger.info('Starting update check');
logger.verbose('Fetching all timesheet entries');
```

## Message Patterns

### Standard Formats

#### Error Pattern

```
Could not [action]: [specific reason]
```

Example: `Could not access network log path: permission denied`

#### Success Pattern

```
[Resource] [action]ed successfully
```

Example: `Credentials stored successfully`

#### State Pattern

```
[Resource] [state]
```

Example: `Update available`

#### Progress Pattern

```
[Action]ing [resource]
```

Example: `Checking for updates`

## Compliance Benefits

### ISO9000

- Clear documentation of operations
- Actionable audit trail
- Consistent terminology

### SOC2

- Precise incident tracking
- Clear security event descriptions
- Unambiguous error reporting

### General Benefits

- Easier log parsing and analysis
- Better searchability
- Clearer troubleshooting
- Improved developer experience
- Machine-learning friendly patterns

## Examples by Category

### Authentication

```typescript
// States
logger.warn('Credentials not found for submission');
logger.info('User authenticated successfully');

// Actions
logger.info('Storing credentials');
logger.error('Could not retrieve credentials');
```

### Database

```typescript
// Initialization
logger.info('Database initialized successfully');
logger.debug('Database connection established');

// Operations
logger.error('Could not save draft timesheet entry');
logger.info('Timesheet entries retrieved', { count: 10 });
```

### Updates

```typescript
// State
logger.info('Update available', { version: '1.2.0' });
logger.info('Update not available');

// Process
logger.info('Checking for updates');
logger.error('Could not check for updates');
```

### Error Handling

```typescript
// Specific and actionable
logger.error('Unhandled promise rejection occurred');
logger.error('Application handled previously unhandled rejection');
logger.error('AutoUpdater encountered error');
```

## Validation Checklist

When writing log messages, verify:

- [ ] Uses active voice
- [ ] Follows tense rules (present for states, past for completed, continuous for ongoing)
- [ ] Avoids "Failed to..." pattern
- [ ] Is specific about what happened
- [ ] Avoids passive constructions
- [ ] Includes relevant context in structured data
- [ ] Is actionable (for errors)

## References

- Google Style Guide: <https://google.github.io/styleguide/>
- Elastic Common Schema: <https://www.elastic.co/guide/en/ecs/current/index.html>
- Twelve-Factor App Logging: <https://12factor.net/logs>
- Structured Logging Best Practices: <https://www.dataset.com/blog/the-10-commandments-of-logging/>
