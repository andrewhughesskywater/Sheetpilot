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
    // Handle Infinity and -Infinity for number schemas
    // Zod's z.number() rejects Infinity by default, but some use cases need it
    if ((input === Infinity || input === -Infinity) && typeof input === 'number') {
      // Check if schema is a number schema by checking its internal type
      const schemaDef = (schema as { _def?: { typeName?: string } })._def;
      if (schemaDef?.typeName === 'ZodNumber') {
        // For number schemas, accept Infinity as a valid number
        return {
          success: true,
          data: input as T
        };
      }
    }
    
    const parsed = schema.parse(input);
    return {
      success: true,
      data: parsed
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((err: z.ZodIssue) => {
        const path = err.path.join('.');
        // Format error messages to be more user-friendly
        let message = err.message;
        // Convert Zod's default messages to more readable format
        if (message.includes('Too big') && message.includes('expected string to have <=')) {
          const maxMatch = message.match(/<=(\d+)/);
          if (maxMatch) {
            message = `String must contain at most ${maxMatch[1]} character${maxMatch[1] !== '1' ? 's' : ''}`;
          }
        } else if (message.includes('Too small') && message.includes('expected string to have >=')) {
          const minMatch = message.match(/>=(\d+)/);
          if (minMatch) {
            message = `String must contain at least ${minMatch[1]} character${minMatch[1] !== '1' ? 's' : ''}`;
          }
        }
        return path ? `${path}: ${message}` : message;
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
      // Include field name in error message for better debugging
      const errorMsg = result.error || 'Validation failed';
      return {
        success: false,
        error: errorMsg.includes(fieldName) ? errorMsg : `${fieldName}: ${errorMsg.replace(/^Invalid input: /, '')}`
      };
    }
    data[fieldName] = result.data;
  }
  
  return {
    success: true,
    data
  };
}

