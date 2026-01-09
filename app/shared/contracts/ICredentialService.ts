/**
 * @fileoverview Credential Service Contract
 *
 * Defines the interface for credential management operations.
 * Any credential storage implementation must implement this interface.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { IPlugin } from '../plugin-types';

/**
 * Credentials for authentication
 */
export interface Credentials {
  email: string;
  password: string;
}

/**
 * Credential record with metadata
 */
export interface CredentialRecord {
  id: number;
  service: string;
  email: string;
  created_at: string;
  updated_at: string;
}

/**
 * Result of credential operations
 */
export interface CredentialResult {
  success: boolean;
  message?: string;
  changes?: number;
  error?: string;
}

/**
 * Result of credential list operation
 */
export interface CredentialListResult {
  success: boolean;
  credentials: CredentialRecord[];
  error?: string;
}

/**
 * Result of credential get operation
 */
export interface CredentialGetResult {
  success: boolean;
  credentials?: Credentials;
  error?: string;
}

/**
 * Credential service interface for authentication credential management
 * Implementations handle secure storage and retrieval of user credentials
 */
export interface ICredentialService extends IPlugin {
  /**
   * Store credentials for a service
   * @param service Service name (e.g., 'smartsheet')
   * @param email User email
   * @param password User password (will be encrypted)
   * @returns Result of store operation
   */
  store(service: string, email: string, password: string): Promise<CredentialResult>;

  /**
   * Get credentials for a service
   * @param service Service name
   * @returns Credentials or null if not found
   */
  get(service: string): Promise<CredentialGetResult>;

  /**
   * List all stored credentials (without passwords)
   * @returns Array of credential records
   */
  list(): Promise<CredentialListResult>;

  /**
   * Delete credentials for a service
   * @param service Service name
   * @returns Result of delete operation
   */
  delete(service: string): Promise<CredentialResult>;
}
