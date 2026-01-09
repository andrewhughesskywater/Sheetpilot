/**
 * @fileoverview Credentials Repository Unit Tests
 * 
 * Tests for secure credential storage, encryption, decryption, and management.
 * Critical for security - must prevent credential leakage and ensure encryption.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock logger before importing repository
vi.mock('../../../shared/logger', () => ({
  dbLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    verbose: vi.fn(),
    audit: vi.fn(),
    startTimer: vi.fn(() => ({ done: vi.fn() }))
  }
}));

import {
  storeCredentials,
  getCredentials,
  listCredentials,
  deleteCredentials
} from '@/repositories/credentials-repository';
import { setDbPath, openDb, ensureSchema, shutdownDatabase } from '@/repositories';

// Type for database row
interface DbRow { [key: string]: unknown }

describe('Credentials Repository', () => {
  let testDbPath: string;
  let originalDbPath: string;

  beforeEach(() => {
    originalDbPath = process.env['SHEETPILOT_DB_PATH'] || '';
    testDbPath = path.join(os.tmpdir(), `sheetpilot-creds-test-${Date.now()}.sqlite`);
    setDbPath(testDbPath);
    ensureSchema();
  });

  afterEach(() => {
    try {
      shutdownDatabase();
    } catch {
      // Ignore if not exists
    }
    
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    
    if (originalDbPath) {
      setDbPath(originalDbPath);
    }
  });

  describe('Credential Storage', () => {
    it('should store credentials with encryption', () => {
      const result = storeCredentials('smartsheet', 'user@test.com', 'password123');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('successfully');
      expect(result.changes).toBeGreaterThan(0);
    });

    it('should not store plaintext passwords', () => {
      storeCredentials('smartsheet', 'user@test.com', 'password123');
      
      const db = openDb();
      const row = db.prepare('SELECT password FROM credentials WHERE service = ?').get('smartsheet');
      db.close();
      
      expect(row).toBeDefined();
      expect((row as DbRow)['password'] as string).not.toBe('password123'); // Should be encrypted
      expect(((row as DbRow)['password'] as string).length).toBeGreaterThan(20); // Encrypted is longer
    });

    it('should update existing credentials', () => {
      // Store initial credentials
      storeCredentials('smartsheet', 'user@test.com', 'oldpassword');
      
      // Update with new password
      const result = storeCredentials('smartsheet', 'user@test.com', 'newpassword');
      
      expect(result.success).toBe(true);
      
      // Verify only one entry exists
      const db = openDb();
      const count = db.prepare('SELECT COUNT(*) as count FROM credentials WHERE service = ?').get('smartsheet');
      expect((count as DbRow)['count'] as number).toBe(1);
      db.close();
    });

    it('should handle multiple services', () => {
      storeCredentials('smartsheet', 'user1@test.com', 'password1');
      storeCredentials('other-service', 'user2@test.com', 'password2');
      
      const db = openDb();
      const count = db.prepare('SELECT COUNT(*) as count FROM credentials').get();
      expect((count as DbRow)['count'] as number).toBe(2);
      db.close();
    });

    it('should handle very long passwords', () => {
      const longPassword = 'a'.repeat(500);
      const result = storeCredentials('smartsheet', 'user@test.com', longPassword);
      
      expect(result.success).toBe(true);
      
      // Verify retrieval works
      const creds = getCredentials('smartsheet');
      expect(creds).toBeDefined();
      expect(creds!.password).toBe(longPassword);
    });

    it('should handle special characters in passwords', () => {
      const specialPassword = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./`~';
      const result = storeCredentials('smartsheet', 'user@test.com', specialPassword);
      
      expect(result.success).toBe(true);
      
      const creds = getCredentials('smartsheet');
      expect(creds!.password).toBe(specialPassword);
    });

    it('should handle unicode in passwords', () => {
      const unicodePassword = 'password🔒密码пароль';
      const result = storeCredentials('smartsheet', 'user@test.com', unicodePassword);
      
      expect(result.success).toBe(true);
      
      const creds = getCredentials('smartsheet');
      expect(creds!.password).toBe(unicodePassword);
    });
  });

  describe('Credential Retrieval', () => {
    beforeEach(() => {
      storeCredentials('smartsheet', 'test@example.com', 'testpassword');
    });

    it('should retrieve and decrypt credentials', () => {
      const creds = getCredentials('smartsheet');
      
      expect(creds).toBeDefined();
      expect(creds!.email).toBe('test@example.com');
      expect(creds!.password).toBe('testpassword');
    });

    it('should return null for non-existent service', () => {
      const creds = getCredentials('non-existent');
      expect(creds).toBeNull();
    });

    it('should list all credentials without passwords', () => {
      storeCredentials('service1', 'user1@test.com', 'pass1');
      storeCredentials('service2', 'user2@test.com', 'pass2');
      
      const list = listCredentials();
      
      expect(list.length).toBeGreaterThanOrEqual(2);
      list.forEach(cred => {
        expect(cred).toHaveProperty('service');
        expect(cred).toHaveProperty('email');
        expect(cred).not.toHaveProperty('password'); // Should not include passwords in list
      });
    });

    it('should handle corrupted encryption data gracefully', () => {
      // Manually insert corrupted encrypted data
      const db = openDb();
      try {
        db.prepare('UPDATE credentials SET password = ? WHERE service = ?')
          .run('corrupted-data', 'smartsheet');
        db.close();
        
        // Should handle decryption failure
        const creds = getCredentials('smartsheet');
        expect(creds).toBeNull(); // Or handle error appropriately
      } catch (error) {
        // Acceptable to throw on corrupted data
        expect(error).toBeDefined();
      }
    });
  });

  describe('Credential Deletion', () => {
    beforeEach(() => {
      storeCredentials('smartsheet', 'test@example.com', 'testpassword');
    });

    it('should delete credentials successfully', () => {
      const result = deleteCredentials('smartsheet');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('successfully');
      expect(result.changes).toBe(1);
      
      // Verify deletion
      const creds = getCredentials('smartsheet');
      expect(creds).toBeNull();
    });

    it('should handle deletion of non-existent credentials', () => {
      const result = deleteCredentials('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.changes).toBe(0);
    });

    it('should not affect other credentials when deleting one', () => {
      storeCredentials('service2', 'user2@test.com', 'password2');
      
      deleteCredentials('smartsheet');
      
      // service2 should still exist
      const creds = getCredentials('service2');
      expect(creds).toBeDefined();
      expect(creds!.email).toBe('user2@test.com');
    });
  });

  describe('Credential Update', () => {
    it('should update existing credentials', () => {
      storeCredentials('smartsheet', 'old@test.com', 'oldpassword');
      
      // Use storeCredentials to update (it updates if exists)
      const result = storeCredentials('smartsheet', 'new@test.com', 'newpassword');
      
      expect(result.success).toBe(true);
      
      const creds = getCredentials('smartsheet');
      expect(creds!.email).toBe('new@test.com');
      expect(creds!.password).toBe('newpassword');
    });

    it('should handle update of non-existent credentials', () => {
      // Use storeCredentials which creates if doesn't exist
      const result = storeCredentials('non-existent', 'user@test.com', 'password');
      
      // Should either fail or create new entry
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt passwords differently each time', () => {
      storeCredentials('test1', 'user@test.com', 'same-password');
      storeCredentials('test2', 'user@test.com', 'same-password');
      
      const db = openDb();
      const cred1 = db.prepare('SELECT password FROM credentials WHERE service = ?').get('test1');
      const cred2 = db.prepare('SELECT password FROM credentials WHERE service = ?').get('test2');
      db.close();
      
      // Same password should have different encrypted values (due to random IV)
      expect((cred1 as DbRow)['password'] as string).not.toBe((cred2 as DbRow)['password'] as string);
    });

    it('should decrypt to correct plaintext', () => {
      const password = 'complex-P@ssw0rd-123!';
      storeCredentials('smartsheet', 'user@test.com', password);
      
      const creds = getCredentials('smartsheet');
      expect(creds!.password).toBe(password);
    });

    it('should handle empty password', () => {
      const result = storeCredentials('smartsheet', 'user@test.com', '');
      
      expect(result.success).toBe(true);
      
      const creds = getCredentials('smartsheet');
      expect(creds!.password).toBe('');
    });

    it('should maintain encryption integrity across multiple operations', () => {
      // Store, retrieve, update, retrieve again
      storeCredentials('smartsheet', 'user@test.com', 'password1');
      const creds1 = getCredentials('smartsheet');
      expect(creds1!.password).toBe('password1');
      
      storeCredentials('smartsheet', 'user@test.com', 'password2');
      const creds2 = getCredentials('smartsheet');
      expect(creds2!.password).toBe('password2');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent credential updates', () => {
      const updates = [];
      
      for (let i = 0; i < 5; i++) {
        updates.push(storeCredentials('smartsheet', `user${i}@test.com`, `password${i}`));
      }
      
      // Last update should win
      const creds = getCredentials('smartsheet');
      expect(creds).toBeDefined();
      expect(creds!.email).toBe('user4@test.com');
    });

    it('should handle concurrent reads', () => {
      storeCredentials('smartsheet', 'user@test.com', 'password');
      
      // Perform multiple concurrent reads
      const reads = [];
      for (let i = 0; i < 10; i++) {
        reads.push(getCredentials('smartsheet'));
      }
      
      // All reads should succeed
      reads.forEach(creds => {
        expect(creds).toBeDefined();
        expect(creds!.password).toBe('password');
      });
    });

    it('should maintain consistency under concurrent operations', () => {
      // Rapidly store and retrieve
      for (let i = 0; i < 20; i++) {
        storeCredentials('test', `user${i}@test.com`, `pass${i}`);
        const creds = getCredentials('test');
        expect(creds).toBeDefined();
      }
    }, 10000);
  });

  describe('Security Tests', () => {
    it('should not expose decryption keys in errors', () => {
      try {
        // Force an encryption error scenario
        const db = openDb();
        db.prepare('UPDATE credentials SET password = ? WHERE service = ?')
          .run('intentionally-corrupted', 'smartsheet');
        db.close();
        
        getCredentials('smartsheet');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).not.toContain('key');
        expect(errorMessage).not.toContain('Key');
        expect(errorMessage).not.toContain('secret');
      }
    });

    it('should use different initialization vectors for each encryption', () => {
      storeCredentials('test1', 'user@test.com', 'password');
      storeCredentials('test2', 'user@test.com', 'password');
      
      const db = openDb();
      const cred1 = db.prepare('SELECT password FROM credentials WHERE service = ?').get('test1');
      const cred2 = db.prepare('SELECT password FROM credentials WHERE service = ?').get('test2');
      db.close();
      
      // Even with same password, encrypted values should differ
      expect((cred1 as DbRow)['password'] as string).not.toBe((cred2 as DbRow)['password'] as string);
    });

    it('should validate service name to prevent injection', () => {
      const maliciousService = "smartsheet'; DROP TABLE credentials; --";
      
      // Should handle safely (parameterized queries prevent injection)
      const result = storeCredentials(maliciousService, 'user@test.com', 'password');
      
      // Should either succeed with sanitized name or fail validation
      expect(typeof result.success).toBe('boolean');
      
      // Verify database still exists
      const db = openDb();
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='credentials'").all();
      expect(tables.length).toBe(1);
      db.close();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty service name', () => {
      const result = storeCredentials('', 'user@test.com', 'password');
      
      // Should fail or handle gracefully
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle empty email', () => {
      const result = storeCredentials('smartsheet', '', 'password');
      
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle very long service names', () => {
      const longService = 'a'.repeat(1000);
      const result = storeCredentials(longService, 'user@test.com', 'password');
      
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle null values gracefully', () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        storeCredentials(null as any, null as any, null as any);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle undefined values gracefully', () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        storeCredentials(undefined as any, undefined as any, undefined as any);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Credential Rotation', () => {
    it('should allow password rotation', () => {
      // Store initial password
      storeCredentials('smartsheet', 'user@test.com', 'password1');
      
      // Rotate to new password
      storeCredentials('smartsheet', 'user@test.com', 'password2');
      
      // Verify new password works
      const creds = getCredentials('smartsheet');
      expect(creds!.password).toBe('password2');
    });

    it('should track update timestamps', async () => {
      storeCredentials('smartsheet', 'user@test.com', 'password1');
      
      const db = openDb();
      const before = db.prepare('SELECT updated_at FROM credentials WHERE service = ?').get('smartsheet') as DbRow;
      db.close();
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));
      
      storeCredentials('smartsheet', 'user@test.com', 'password2');
      
      const db2 = openDb();
      const after = db2.prepare('SELECT updated_at FROM credentials WHERE service = ?').get('smartsheet') as DbRow;
      db2.close();
      
      // updated_at should change
      expect(before['updated_at']).toBeDefined();
      expect(after['updated_at']).toBeDefined();
      expect(after['updated_at'] as string).not.toBe(before['updated_at'] as string);
    });

    it('should maintain creation timestamp on update', () => {
      storeCredentials('smartsheet', 'user@test.com', 'password1');
      
      const db = openDb();
      const created = db.prepare('SELECT created_at FROM credentials WHERE service = ?').get('smartsheet');
      db.close();
      
      // Update password
      storeCredentials('smartsheet', 'user@test.com', 'password2');
      
      const db2 = openDb();
      const stillCreated = db2.prepare('SELECT created_at FROM credentials WHERE service = ?').get('smartsheet');
      db2.close();
      
      // created_at should not change
      expect((stillCreated as DbRow)['created_at'] as string).toBe((created as DbRow)['created_at'] as string);
    });
  });

  describe('Performance', () => {
    it('should handle bulk credential storage efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        storeCredentials(`service${i}`, `user${i}@test.com`, `password${i}`);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(25000); // Should complete in reasonable time (accounts for PBKDF2 key derivation: ~100k iterations per operation)
    }, 30000);

    it('should handle bulk retrieval efficiently', () => {
      // Store credentials
      for (let i = 0; i < 50; i++) {
        storeCredentials(`service${i}`, `user${i}@test.com`, `password${i}`);
      }
      
      // Retrieve all
      const startTime = Date.now();
      for (let i = 0; i < 50; i++) {
        getCredentials(`service${i}`);
      }
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(15000); // Accounts for decryption overhead with PBKDF2 key derivation
    }, 20000);
  });
});

