import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SQLiteCredentialService } from '../../../src/services/plugins/sqlite-credential-service';
import * as db from '../../../src/services/database';

// Mock database
vi.mock('../../../src/services/database', () => ({
  storeCredentials: vi.fn(),
  getCredentials: vi.fn(),
  listCredentials: vi.fn(),
  deleteCredentials: vi.fn()
}));

describe('SQLiteCredentialService', () => {
  let service: SQLiteCredentialService;

  beforeEach(() => {
    service = new SQLiteCredentialService();
    vi.clearAllMocks();
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(service.metadata.name).toBe('sqlite');
      expect(service.metadata.version).toBe('1.1.2');
      expect(service.metadata.author).toBe('Andrew Hughes');
    });
  });

  describe('store', () => {
    it('should store credentials successfully', async () => {
      vi.mocked(db.storeCredentials).mockReturnValue({
        success: true,
        message: 'Credentials stored',
        changes: 1
      });

      const result = await service.store('smartsheet', 'test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(db.storeCredentials).toHaveBeenCalledWith('smartsheet', 'test@example.com', 'password123');
    });

    it('should handle storage errors', async () => {
      vi.mocked(db.storeCredentials).mockImplementation(() => {
        throw new Error('Storage failed');
      });

      const result = await service.store('smartsheet', 'test@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage failed');
      expect(result.changes).toBe(0);
    });
  });

  describe('get', () => {
    it('should get credentials successfully', async () => {
      vi.mocked(db.getCredentials).mockReturnValue({
        email: 'test@example.com',
        password: 'password123'
      });

      const result = await service.get('smartsheet');

      expect(result.success).toBe(true);
      expect(result.credentials).toEqual({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    it('should return error when credentials not found', async () => {
      vi.mocked(db.getCredentials).mockReturnValue(null);

      const result = await service.get('smartsheet');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Credentials not found');
    });

    it('should handle get errors', async () => {
      vi.mocked(db.getCredentials).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.get('smartsheet');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('list', () => {
    it('should list credentials successfully', async () => {
      const mockCredentials = [
        {
          id: 1,
          service: 'smartsheet',
          email: 'test@example.com',
          created_at: '2025-01-01',
          updated_at: '2025-01-01'
        }
      ];

      vi.mocked(db.listCredentials).mockReturnValue({
        success: true,
        credentials: mockCredentials
      });

      const result = await service.list();

      expect(result.success).toBe(true);
      expect(result.credentials).toEqual(mockCredentials);
    });

    it('should handle list errors', async () => {
      vi.mocked(db.listCredentials).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.list();

      expect(result.success).toBe(false);
      expect(result.credentials).toEqual([]);
      expect(result.error).toBe('Database error');
    });
  });

  describe('delete', () => {
    it('should delete credentials successfully', async () => {
      vi.mocked(db.deleteCredentials).mockReturnValue({
        success: true,
        message: 'Credentials deleted',
        changes: 1
      });

      const result = await service.delete('smartsheet');

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(db.deleteCredentials).toHaveBeenCalledWith('smartsheet');
    });

    it('should handle delete errors', async () => {
      vi.mocked(db.deleteCredentials).mockImplementation(() => {
        throw new Error('Delete failed');
      });

      const result = await service.delete('smartsheet');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
      expect(result.changes).toBe(0);
    });
  });
});


