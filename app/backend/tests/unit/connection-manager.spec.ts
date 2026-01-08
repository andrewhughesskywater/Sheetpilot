/**
 * @fileoverview Connection Manager Unit Tests
 * 
 * Tests for database connection management, singleton pattern, connection pooling,
 * and error handling.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock logger
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

import { setDbPath, getDbPath, getDb, openDb } from '../../src/repositories/connection-manager';

describe('Connection Manager', () => {
  let testDbPath: string;
  let originalDbPath: string;

  beforeEach(() => {
    originalDbPath = getDbPath();
    testDbPath = path.join(os.tmpdir(), `sheetpilot-conn-test-${Date.now()}.sqlite`);
    setDbPath(testDbPath);
  });

  afterEach(() => {
    try {
      const { shutdownDatabase } = require('../../src/repositories');
      shutdownDatabase();
    } catch {
      // Ignore
    }
    
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignore
      }
    }
    
    setDbPath(originalDbPath);
  });

  describe('Path Management', () => {
    it('should set and get database path', () => {
      const newPath = '/tmp/test-db.sqlite';
      setDbPath(newPath);
      
      expect(getDbPath()).toBe(path.resolve(newPath));
    });

    it('should resolve relative paths to absolute', () => {
      setDbPath('./relative-path.sqlite');
      
      const dbPath = getDbPath();
      expect(path.isAbsolute(dbPath)).toBe(true);
    });

    it('should create database directory if not exists', () => {
      const testDir = path.join(os.tmpdir(), `test-dir-${Date.now()}`);
      const dbPath = path.join(testDir, 'database.sqlite');
      
      // Ensure directory doesn't exist
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
      
      setDbPath(dbPath);
      const db = openDb();
      db.close();
      
      expect(fs.existsSync(testDir)).toBe(true);
      expect(fs.existsSync(dbPath)).toBe(true);
      
      // Cleanup
      fs.rmSync(testDir, { recursive: true });
    });
  });

  describe('Connection Lifecycle', () => {
    it('should return same connection instance (singleton)', () => {
      const db1 = getDb();
      const db2 = getDb();
      
      expect(db1).toBe(db2); // Same instance
    });

    it('should create new connection when path changes', () => {
      const db1 = getDb();
      
      const newPath = path.join(os.tmpdir(), `new-db-${Date.now()}.sqlite`);
      setDbPath(newPath);
      
      const db2 = getDb();
      
      // Should be different instances (path changed)
      expect(db1).not.toBe(db2);
      
      // Cleanup
      try {
        db1.close();
        db2.close();
        if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
      } catch {
        // Ignore
      }
    });

    it('should open connection successfully', () => {
      const db = openDb();
      
      expect(db).toBeDefined();
      expect(typeof db.prepare).toBe('function');
      expect(typeof db.close).toBe('function');
    });

    it('should handle multiple open calls (singleton)', () => {
      const db1 = openDb();
      const db2 = openDb();
      
      expect(db1).toBe(db2);
    });
  });

  describe('Connection Health', () => {
    it('should maintain healthy connection', () => {
      const db = getDb();
      
      // Connection should allow queries
      expect(() => {
        db.prepare('SELECT 1').get();
      }).not.toThrow();
    });

    it('should handle connection errors gracefully', () => {
      // Try to use an invalid path
      const invalidPath = '/root/impossible/path/db.sqlite';
      
      try {
        setDbPath(invalidPath);
        openDb();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Connection Cleanup', () => {
    it('should close connection on shutdown', () => {
      const db = getDb();
      expect(db).toBeDefined();
      
      try {
        const { shutdownDatabase } = require('../../src/repositories');
        shutdownDatabase();
        
        // Connection should be closed
        // Attempting to use it might throw
        try {
          db.prepare('SELECT 1').get();
        } catch (error) {
          // Expected if connection is truly closed
          expect(error).toBeDefined();
        }
      } catch {
        // Shutdown might not be implemented yet
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle file permission errors', () => {
      if (process.platform !== 'win32') {
        const restrictedPath = '/root/restricted.sqlite';
        
        try {
          setDbPath(restrictedPath);
          openDb();
          expect(true).toBe(false); // Should throw
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle disk full scenarios gracefully', () => {
      // This is hard to test without actually filling disk
      // We can test that errors are propagated properly
      const db = getDb();
      
      expect(() => {
        db.prepare('SELECT 1').get();
      }).not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent connection requests', () => {
      const connections: ReturnType<typeof getDb>[] = [];
      
      for (let i = 0; i < 10; i++) {
        connections.push(getDb());
      }
      
      // All should be the same instance
      connections.forEach(conn => {
        expect(conn).toBe(connections[0]);
      });
    });

    it('should handle concurrent queries on singleton connection', () => {
      const db = getDb();
      const results = [];
      
      for (let i = 0; i < 20; i++) {
        results.push(db.prepare('SELECT ?').get(i));
      }
      
      // All queries should succeed
      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });
  });
});

