/**
 * @fileoverview SQLite Credential Service Plugin
 * 
 * Implementation of ICredentialService using SQLite database.
 * Wraps existing credential functions with the plugin interface.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type {
  ICredentialService,
  CredentialResult,
  CredentialListResult,
  CredentialGetResult,
  CredentialRecord
} from '../../shared/contracts/ICredentialService';
import type { PluginMetadata } from '../../shared/plugin-types';
import {
  storeCredentials,
  getCredentials,
  listCredentials,
  deleteCredentials
} from '../database';

/**
 * SQLite implementation of the credential service
 */
export class SQLiteCredentialService implements ICredentialService {
  public readonly metadata: PluginMetadata = {
    name: 'sqlite',
    version: '1.1.2',
    author: 'Andrew Hughes',
    description: 'SQLite-based credential storage service'
  };

  /**
   * Store credentials for a service
   */
  public async store(service: string, email: string, password: string): Promise<CredentialResult> {
    try {
      const result = storeCredentials(service, email, password);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        changes: 0
      };
    }
  }

  /**
   * Get credentials for a service
   */
  public async get(service: string): Promise<CredentialGetResult> {
    try {
      const credentials = getCredentials(service);
      
      if (!credentials) {
        return {
          success: false,
          error: `Credentials not found for service: ${service}`
        };
      }
      
      return {
        success: true,
        credentials
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List all stored credentials (without passwords)
   */
  public async list(): Promise<CredentialListResult> {
    try {
      const credentials = listCredentials() as CredentialRecord[];
      return {
        success: true,
        credentials
      };
    } catch (error) {
      return {
        success: false,
        credentials: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete credentials for a service
   */
  public async delete(service: string): Promise<CredentialResult> {
    try {
      const result = deleteCredentials(service);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        changes: 0
      };
    }
  }
}

