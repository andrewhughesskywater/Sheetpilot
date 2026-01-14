/**
 * @fileoverview IPC Input Validation Utility
 * 
 * Provides helper functions for validating IPC handler inputs using Zod schemas.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { z } from 'zod';
import { ipcLogger } from '@sheetpilot/shared/logger';

/**
 * Validation result for IPC inputs
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Validates IPC input against a Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @param input - Input data to validate
 * @param handlerName - Name of the IPC handler (for logging)
 * @returns Validation result with parsed data or error message
 * 
 * @example
 * const result = validateInput(loginSchema, { email, password, stayLoggedIn }, 'auth:login');
 * if (!result.success) {
 *   return { success: false, error: result.error };
 * }
 * const { email, password, stayLoggedIn } = result.data;
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  handlerName: string
): ValidationResult<T> {
  try {
    const parsed = schema.parse(input);
    return {
      success: true,
      data: parsed
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((err: z.ZodIssue) => {
        const path = err.path.join('.');
        return path ? `${path}: ${err.message}` : err.message;
      }).join('; ');
      
      ipcLogger.warn('Input validation failed', {
        handler: handlerName,
        errors: error.issues,
        errorMessage: errorMessages
      });
      
      return {
        success: false,
        error: `Invalid input: ${errorMessages}`
      };
    }
    
    // Unexpected error
    ipcLogger.error('Validation error', {
      handler: handlerName,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return {
      success: false,
      error: 'Validation failed'
    };
  }
}

/**
 * Validates multiple inputs at once
 * Returns error for the first invalid input
 * 
 * @param validations - Array of validation tuples [schema, input, field name]
 * @param handlerName - Name of the IPC handler (for logging)
 * @returns Object with success flag and parsed data or error
 * 
 * @example
 * const result = validateMultiple([
 *   [emailSchema, email, 'email'],
 *   [passwordSchema, password, 'password']
 * ], 'auth:login');
 */
export function validateMultiple(
  validations: Array<[z.ZodSchema, unknown, string]>,
  handlerName: string
): ValidationResult<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  
  for (const [schema, input, fieldName] of validations) {
    const result = validateInput(schema, input, `${handlerName}.${fieldName}`);
    if (!result.success) {
      // Include field name in error message
      const errorMessage = result.error 
        ? result.error.replace('Invalid input: ', `Invalid input for ${fieldName}: `)
        : `Validation failed for ${fieldName}`;
      return {
        success: false,
        error: errorMessage
      };
    }
    data[fieldName] = result.data;
  }
  
  return {
    success: true,
    data
  };
}

