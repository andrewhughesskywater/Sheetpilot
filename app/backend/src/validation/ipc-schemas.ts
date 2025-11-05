/**
 * @fileoverview IPC Input Validation Schemas
 * 
 * Provides Zod schemas for validating all IPC handler inputs.
 * Ensures type safety and prevents injection attacks.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/**
 * Email validation schema
 * Ensures valid email format and reasonable length
 */
export const emailSchema = z.string()
  .email('Invalid email format')
  .min(3, 'Email must be at least 3 characters')
  .max(255, 'Email must not exceed 255 characters');

/**
 * Password validation schema
 * Enforces minimum security requirements
 */
export const passwordSchema = z.string()
  .min(1, 'Password is required')
  .max(1000, 'Password too long'); // Allow long passwords but have reasonable upper limit

/**
 * Service name validation schema
 */
export const serviceNameSchema = z.string()
  .min(1, 'Service name is required')
  .max(100, 'Service name too long')
  .regex(/^[a-z0-9_-]+$/i, 'Service name must contain only letters, numbers, hyphens, and underscores');

/**
 * Session token validation schema
 */
export const sessionTokenSchema = z.string()
  .uuid('Invalid session token format');

/**
 * Date validation schema (YYYY-MM-DD or MM/DD/YYYY)
 */
export const dateSchema = z.string()
  .regex(/^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/, 'Invalid date format. Use YYYY-MM-DD or MM/DD/YYYY');

/**
 * Time validation schema (HH:MM)
 */
export const timeSchema = z.string()
  .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM');

/**
 * Project name validation schema
 */
export const projectNameSchema = z.string()
  .min(1, 'Project name is required')
  .max(500, 'Project name too long');

/**
 * Task description validation schema
 */
export const taskDescriptionSchema = z.string()
  .min(1, 'Task description is required')
  .max(5000, 'Task description too long');

// ============================================================================
// CREDENTIALS SCHEMAS
// ============================================================================

/**
 * Schema for credentials:store
 */
export const storeCredentialsSchema = z.object({
  service: serviceNameSchema,
  email: emailSchema,
  password: passwordSchema
});

/**
 * Schema for credentials:get
 */
export const getCredentialsSchema = z.object({
  service: serviceNameSchema
});

/**
 * Schema for credentials:delete
 */
export const deleteCredentialsSchema = z.object({
  service: serviceNameSchema
});

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

/**
 * Schema for auth:login
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  stayLoggedIn: z.boolean()
});

/**
 * Schema for auth:validateSession
 */
export const validateSessionSchema = z.object({
  token: sessionTokenSchema
});

/**
 * Schema for auth:logout
 */
export const logoutSchema = z.object({
  token: sessionTokenSchema
});

/**
 * Schema for auth:getCurrentSession
 */
export const getCurrentSessionSchema = z.object({
  token: sessionTokenSchema
});

// ============================================================================
// TIMESHEET SCHEMAS
// ============================================================================

/**
 * Schema for timesheet:saveDraft
 */
export const saveDraftSchema = z.object({
  id: z.number().int().positive().optional(),
  date: dateSchema,
  timeIn: timeSchema,
  timeOut: timeSchema,
  project: projectNameSchema,
  tool: z.string().max(500).nullable().optional(),
  chargeCode: z.string().max(100).nullable().optional(),
  taskDescription: taskDescriptionSchema
}).refine((data) => {
  // Validate that timeOut is after timeIn
  const parseTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };
  return parseTime(data.timeOut) > parseTime(data.timeIn);
}, {
  message: 'Time Out must be after Time In',
  path: ['timeOut']
});

/**
 * Schema for timesheet:deleteDraft
 */
export const deleteDraftSchema = z.object({
  id: z.number().int().positive('Valid ID is required')
});

/**
 * Schema for timesheet:submit
 */
export const submitTimesheetsSchema = z.object({
  token: sessionTokenSchema
});

// ============================================================================
// ADMIN SCHEMAS
// ============================================================================

/**
 * Schema for admin operations requiring token
 */
export const adminTokenSchema = z.object({
  token: sessionTokenSchema
});

// ============================================================================
// DATABASE VIEWER SCHEMAS
// ============================================================================

/**
 * Schema for database:getAllTimesheetEntries
 */
export const getAllTimesheetEntriesSchema = z.object({
  token: sessionTokenSchema
});

// ============================================================================
// LOGS SCHEMAS
// ============================================================================

/**
 * Schema for logs:readLogFile
 */
export const readLogFileSchema = z.object({
  logPath: z.string().min(1).max(1000)
});

/**
 * Schema for logs:exportLogs
 */
export const exportLogsSchema = z.object({
  logPath: z.string().min(1).max(1000),
  exportFormat: z.enum(['json', 'txt']).optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Export TypeScript types derived from schemas
export type StoreCredentials = z.infer<typeof storeCredentialsSchema>;
export type GetCredentials = z.infer<typeof getCredentialsSchema>;
export type DeleteCredentials = z.infer<typeof deleteCredentialsSchema>;
export type Login = z.infer<typeof loginSchema>;
export type ValidateSession = z.infer<typeof validateSessionSchema>;
export type Logout = z.infer<typeof logoutSchema>;
export type GetCurrentSession = z.infer<typeof getCurrentSessionSchema>;
export type SaveDraft = z.infer<typeof saveDraftSchema>;
export type DeleteDraft = z.infer<typeof deleteDraftSchema>;
export type SubmitTimesheets = z.infer<typeof submitTimesheetsSchema>;
export type AdminToken = z.infer<typeof adminTokenSchema>;
export type GetAllTimesheetEntries = z.infer<typeof getAllTimesheetEntriesSchema>;
export type ReadLogFile = z.infer<typeof readLogFileSchema>;
export type ExportLogs = z.infer<typeof exportLogsSchema>;


