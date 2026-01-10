/**
 * @fileoverview Credentials Repository
 *
 * Handles all credential storage and retrieval operations with secure encryption.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import * as crypto from 'crypto';
import * as os from 'os';

import { getDb } from './connection-manager';
import { dbLogger } from './utils/logger';

/**
 * Get or create the master encryption key
 */
function getMasterKey(): Buffer {
  const masterSecret = process.env['SHEETPILOT_MASTER_KEY'] || `sheetpilot-${os.hostname()}-${os.userInfo().username}`;

  // Derive a 32-byte key using PBKDF2
  return crypto.pbkdf2Sync(masterSecret, 'sheetpilot-salt-v1', 100000, 32, 'sha256');
}

/**
 * Encrypts a password using AES-256-GCM
 */
function encryptPassword(password: string): string {
  try {
    const key = getMasterKey();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);

    return combined.toString('base64');
  } catch (error) {
    dbLogger.error('Encryption failed', error);
    throw new Error('Could not encrypt password');
  }
}

/**
 * Decrypts a password using AES-256-GCM
 */
function decryptPassword(encryptedPassword: string): string {
  try {
    const key = getMasterKey();
    const combined = Buffer.from(encryptedPassword, 'base64');

    const iv = combined.subarray(0, 16);
    const authTag = combined.subarray(16, 32);
    const encrypted = combined.subarray(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    dbLogger.error('Decryption failed', error);
    throw new Error('Could not decrypt password');
  }
}

/**
 * Stores or updates credentials for a service
 */
export function storeCredentials(service: string, email: string, password: string): void {
  const timer = dbLogger.startTimer('store-credentials');
  const db = getDb();

  try {
    dbLogger.verbose('Storing credentials', { service, email });
    const encryptedPassword = encryptPassword(password);

    const existing = db.prepare('SELECT id FROM credentials WHERE service = ?').get(service);

    let result;
    if (existing) {
      const update = db.prepare(`
                UPDATE credentials 
                SET email = ?, password = ?, updated_at = CURRENT_TIMESTAMP
                WHERE service = ?
            `);
      result = update.run(email, encryptedPassword, service);
    } else {
      const insert = db.prepare(`
                INSERT INTO credentials (service, email, password, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `);
      result = insert.run(service, email, encryptedPassword);
    }

    dbLogger.audit('store-credentials', 'Credentials stored', {
      service,
      email,
      changes: result.changes,
    });
    timer.done({ changes: result.changes });

    return {
      success: true,
      message: 'Credentials stored successfully',
      changes: result.changes,
    };
  } catch (error) {
    dbLogger.error('Could not store credentials', error);
    timer.done({ outcome: 'error' });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      changes: 0,
    };
  }
}

/**
 * Retrieves credentials for a service
 */
export function getCredentials(service: string): { email: string; password: string } | null {
  const timer = dbLogger.startTimer('get-credentials');
  const db = getDb();

  try {
    dbLogger.verbose('Retrieving credentials', { service });
    const getCreds = db.prepare(`
            SELECT email, password FROM credentials 
            WHERE service = ? 
            ORDER BY updated_at DESC 
            LIMIT 1
        `);

    const result = getCreds.get(service) as { email: string; password: string } | undefined;

    if (!result) {
      dbLogger.verbose('No credentials found', { service });
      timer.done({ found: false });
      return null;
    }

    dbLogger.audit('get-credentials', 'Credentials retrieved', {
      service,
      email: result.email,
    });
    timer.done({ found: true, email: result.email });

    return {
      email: result.email,
      password: decryptPassword(result.password),
    };
  } catch (error: unknown) {
    dbLogger.error('Could not retrieve credentials', error);
    timer.done({ outcome: 'error' });
    return null;
  }
}

/**
 * Lists all stored credentials (without passwords)
 */
export function listCredentials(): Array<{ service: string; email: string }> {
  const db = getDb();

  try {
    const listCreds = db.prepare(`
            SELECT service, email
            FROM credentials 
            ORDER BY service
        `);

    return listCreds.all() as Array<{ service: string; email: string }>;
  } catch (error) {
    dbLogger.error('Error listing credentials', error);
    return [];
  }
}

/**
 * Deletes credentials for a service
 */
export function deleteCredentials(service: string): { success: boolean; message: string; changes: number } {
  const timer = dbLogger.startTimer('delete-credentials');
  const db = getDb();

  try {
    dbLogger.verbose('Deleting credentials', { service });
    const deleteCreds = db.prepare(`
            DELETE FROM credentials 
            WHERE service = ?
        `);

    const result = deleteCreds.run(service);

    if (result.changes > 0) {
      dbLogger.audit('delete-credentials', 'Credentials deleted', {
        service,
      });
    } else {
      dbLogger.verbose('No credentials found to delete', { service });
    }
    timer.done({ changes: result.changes });

    return {
      success: result.changes > 0,
      message: result.changes > 0 ? 'Credentials deleted successfully' : 'No credentials found',
      changes: result.changes,
    };
  } catch (error) {
    dbLogger.error('Could not delete credentials', error);
    timer.done({ outcome: 'error' });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      changes: 0,
    };
  }
}

/**
 * Clears all credentials from the database
 */
export function clearAllCredentials(): void {
  const timer = dbLogger.startTimer('clear-all-credentials');
  const db = getDb();

  try {
    dbLogger.info('Clearing all credentials');

    const deleteAll = db.prepare('DELETE FROM credentials');
    const result = deleteAll.run();

    dbLogger.info('All credentials cleared', { count: result.changes });
    timer.done({ changes: result.changes });
  } catch (error) {
    dbLogger.error('Could not clear all credentials', error);
    timer.done({ outcome: 'error' });
    throw error;
  }
}
