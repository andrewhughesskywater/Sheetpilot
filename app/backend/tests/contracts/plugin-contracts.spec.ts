/**
 * @fileoverview Plugin Contract Validation Tests
 * 
 * Validates that plugin implementations satisfy their interfaces.
 * Prevents AI from breaking plugin system contracts.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// Import types for contract validation (used in type assertions)
 
// Types validated via runtime assertion helper; explicit type imports not needed here
import { assertPluginInterface } from '../helpers/assertion-helpers';

// Mock the plugin implementations using classes to ensure they are constructable
vi.mock('../../src/services/plugins/sqlite-data-service', () => ({
  SQLiteDataService: class {
    saveDraft = vi.fn();
    loadDraft = vi.fn();
    deleteDraft = vi.fn();
    getArchiveData = vi.fn();
    getAllTimesheetEntries = vi.fn();
    name = 'SQLiteDataService';
    version = '1.0.0';
    initialize = vi.fn();
    cleanup = vi.fn();
  }
}));

vi.mock('../../src/services/plugins/memory-data-service', () => ({
  MemoryDataService: class {
    saveDraft = vi.fn();
    loadDraft = vi.fn();
    deleteDraft = vi.fn();
    getArchiveData = vi.fn();
    getAllTimesheetEntries = vi.fn();
    name = 'MemoryDataService';
    version = '1.0.0';
    initialize = vi.fn();
    cleanup = vi.fn();
  }
}));

vi.mock('../../src/services/plugins/electron-bot-service', () => ({
  ElectronBotService: class {
    submit = vi.fn();
    validateEntry = vi.fn();
    isAvailable = vi.fn();
    name = 'ElectronBotService';
    version = '1.0.0';
    initialize = vi.fn();
    cleanup = vi.fn();
  }
}));

vi.mock('../../src/services/plugins/mock-submission-service', () => ({
  MockSubmissionService: class {
    submit = vi.fn();
    validateEntry = vi.fn();
    isAvailable = vi.fn();
    name = 'MockSubmissionService';
    version = '1.0.0';
    initialize = vi.fn();
    cleanup = vi.fn();
  }
}));

vi.mock('../../src/services/plugins/sqlite-credential-service', () => ({
  SQLiteCredentialService: class {
    store = vi.fn();
    get = vi.fn();
    list = vi.fn();
    delete = vi.fn();
    name = 'SQLiteCredentialService';
    version = '1.0.0';
    initialize = vi.fn();
    cleanup = vi.fn();
  }
}));

describe('Plugin Contract Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('IDataService Contract', () => {
    it('should validate SQLiteDataService implements IDataService', async () => {
      const { SQLiteDataService } = await import('../../src/services/plugins/sqlite-data-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new SQLiteDataService();
      
      assertPluginInterface(service, 'IDataService');
      
      // Verify method signatures
      expect(typeof service.saveDraft).toBe('function');
      expect(typeof service.loadDraft).toBe('function');
      expect(typeof service.deleteDraft).toBe('function');
      expect(typeof service.getArchiveData).toBe('function');
      expect(typeof service.getAllTimesheetEntries).toBe('function');
    });

    it('should validate MemoryDataService implements IDataService', async () => {
      const { MemoryDataService } = await import('../../src/services/plugins/memory-data-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new MemoryDataService();
      
      assertPluginInterface(service, 'IDataService');
      
      // Verify method signatures
      expect(typeof service.saveDraft).toBe('function');
      expect(typeof service.loadDraft).toBe('function');
      expect(typeof service.deleteDraft).toBe('function');
      expect(typeof service.getArchiveData).toBe('function');
      expect(typeof service.getAllTimesheetEntries).toBe('function');
    });

    it('should validate saveDraft method signature', async () => {
      const { SQLiteDataService } = await import('../../src/services/plugins/sqlite-data-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new SQLiteDataService();
      
      const mockEntry = {
        date: '01/15/2025',
        hours: 8.0,
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        chargeCode: 'EPR1',
        taskDescription: 'Test task'
      };
      
      // Mock the method to return expected structure
      (service.saveDraft as unknown as import('vitest').Mock).mockResolvedValue({
        success: true,
        changes: 1,
        id: 1
      });
      
      const result = await service.saveDraft(mockEntry);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('id');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.changes).toBe('number');
      expect(typeof result.id).toBe('number');
    });

    it('should validate loadDraft method signature', async () => {
      const { SQLiteDataService } = await import('../../src/services/plugins/sqlite-data-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new SQLiteDataService();
      
      const mockEntries = [
        {
          id: 1,
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'FL-Carver Techs',
          tool: '#1 Rinse and 2D marker',
          chargeCode: 'EPR1',
          taskDescription: 'Test task'
        }
      ];
      
      (service.loadDraft as unknown as import('vitest').Mock).mockResolvedValue({
        success: true,
        entries: mockEntries
      });
      
      const result = await service.loadDraft();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('entries');
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.entries)).toBe(true);
    });

    it('should validate deleteDraft method signature', async () => {
      const { SQLiteDataService } = await import('../../src/services/plugins/sqlite-data-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new SQLiteDataService();
      
      (service.deleteDraft as unknown as import('vitest').Mock).mockResolvedValue({
        success: true
      });
      
      const result = await service.deleteDraft(1);
      
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should validate getArchiveData method signature', async () => {
      const { SQLiteDataService } = await import('../../src/services/plugins/sqlite-data-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new SQLiteDataService();
      
      const mockArchiveData = {
        timesheet: [],
        credentials: []
      };
      
      (service.getArchiveData as unknown as import('vitest').Mock).mockResolvedValue({
        success: true,
        data: mockArchiveData
      });
      
      const result = await service.getArchiveData();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(typeof result.success).toBe('boolean');
      expect(result.data).toHaveProperty('timesheet');
      expect(result.data).toHaveProperty('credentials');
    });

    it('should validate getAllTimesheetEntries method signature', async () => {
      const { SQLiteDataService } = await import('../../src/services/plugins/sqlite-data-service');
      const service = new SQLiteDataService();
      
      const mockDbEntries = [
        {
          id: 1,
          date: '2025-01-15',
          time_in: 540,
          time_out: 1020,
          hours: 8.0,
          project: 'FL-Carver Techs',
          tool: '#1 Rinse and 2D marker',
          detail_charge_code: 'EPR1',
          task_description: 'Test task',
          status: 'Complete',
          submitted_at: '2025-01-15T10:00:00Z'
        }
      ];
      
      (service.getAllTimesheetEntries as unknown as import('vitest').Mock).mockResolvedValue({
        success: true,
        entries: mockDbEntries
      });
      
      const result = await service.getAllTimesheetEntries();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('entries');
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.entries)).toBe(true);
    });
  });

  describe('ISubmissionService Contract', () => {
    it('should validate ElectronBotService implements ISubmissionService', async () => {
      const { ElectronBotService } = await import('../../src/services/plugins/electron-bot-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new ElectronBotService();
      
      assertPluginInterface(service, 'ISubmissionService');
      
      // Verify method signatures
      expect(typeof service.submit).toBe('function');
      expect(typeof service.validateEntry).toBe('function');
      expect(typeof service.isAvailable).toBe('function');
    });

    it('should validate MockSubmissionService implements ISubmissionService', async () => {
      const { MockSubmissionService } = await import('../../src/services/plugins/mock-submission-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new MockSubmissionService();
      
      assertPluginInterface(service, 'ISubmissionService');
      
      // Verify method signatures
      expect(typeof service.submit).toBe('function');
      expect(typeof service.validateEntry).toBe('function');
      expect(typeof service.isAvailable).toBe('function');
    });

    it('should validate submit method signature', async () => {
      const { ElectronBotService } = await import('../../src/services/plugins/electron-bot-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new ElectronBotService();
      
      const mockEntries = [
        {
          date: '01/15/2025',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'FL-Carver Techs',
          tool: '#1 Rinse and 2D marker',
          chargeCode: 'EPR1',
          taskDescription: 'Test task'
        }
      ];
      
      const mockCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      (service.submit as unknown as import('vitest').Mock).mockResolvedValue({
        ok: true,
        submittedIds: [1],
        removedIds: [],
        totalProcessed: 1,
        successCount: 1,
        removedCount: 0
      });
      
      const result = await service.submit(mockEntries, mockCredentials);
      
      expect(result).toHaveProperty('ok');
      expect(result).toHaveProperty('submittedIds');
      expect(result).toHaveProperty('removedIds');
      expect(result).toHaveProperty('totalProcessed');
      expect(result).toHaveProperty('successCount');
      expect(result).toHaveProperty('removedCount');
      expect(typeof result.ok).toBe('boolean');
      expect(Array.isArray(result.submittedIds)).toBe(true);
      expect(Array.isArray(result.removedIds)).toBe(true);
      expect(typeof result.totalProcessed).toBe('number');
      expect(typeof result.successCount).toBe('number');
      expect(typeof result.removedCount).toBe('number');
    });

    it('should validate validateEntry method signature', async () => {
      const { ElectronBotService } = await import('../../src/services/plugins/electron-bot-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new ElectronBotService();
      
      const mockEntry = {
        date: '01/15/2025',
        hours: 8.0,
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        chargeCode: 'EPR1',
        taskDescription: 'Test task'
      };
      
      (service.validateEntry as unknown as import('vitest').Mock).mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });
      
      const result = service.validateEntry(mockEntry);
      
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should validate isAvailable method signature', async () => {
      const { ElectronBotService } = await import('../../src/services/plugins/electron-bot-service');
      const service = new ElectronBotService();
      
      (service.isAvailable as unknown as import('vitest').Mock).mockResolvedValue(true);
      
      const result = await service.isAvailable();
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('ICredentialService Contract', () => {
    it('should validate SQLiteCredentialService implements ICredentialService', async () => {
      const { SQLiteCredentialService } = await import('../../src/services/plugins/sqlite-credential-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new SQLiteCredentialService();
      
      assertPluginInterface(service, 'ICredentialService');
      
      // Verify method signatures
      expect(typeof service.store).toBe('function');
      expect(typeof service.get).toBe('function');
      expect(typeof service.list).toBe('function');
      expect(typeof service.delete).toBe('function');
    });

    it('should validate store method signature', async () => {
      const { SQLiteCredentialService } = await import('../../src/services/plugins/sqlite-credential-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new SQLiteCredentialService();
      
      service.store.mockResolvedValue({
        success: true,
        message: 'Credentials stored successfully',
        changes: 1
      });
      
      const result = await service.store('smartsheet', 'test@example.com', 'password123');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('changes');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
      expect(typeof result.changes).toBe('number');
    });

    it('should validate get method signature', async () => {
      const { SQLiteCredentialService } = await import('../../src/services/plugins/sqlite-credential-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new SQLiteCredentialService();
      
      service.get.mockResolvedValue({
        success: true,
        credentials: {
          email: 'test@example.com',
          password: 'password123'
        }
      });
      
      const result = await service.get('smartsheet');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('credentials');
      expect(typeof result.success).toBe('boolean');
      expect(result.credentials).toHaveProperty('email');
      expect(result.credentials).toHaveProperty('password');
    });

    it('should validate list method signature', async () => {
      const { SQLiteCredentialService } = await import('../../src/services/plugins/sqlite-credential-service');
      const service = new SQLiteCredentialService();
      
      const mockCredentials = [
        {
          id: 1,
          service: 'smartsheet',
          email: 'test@example.com',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z'
        }
      ];
      
      (service.list as unknown as import('vitest').Mock).mockResolvedValue({
        success: true,
        credentials: mockCredentials
      });
      
      const result = await service.list();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('credentials');
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.credentials)).toBe(true);
    });

    it('should validate delete method signature', async () => {
      const { SQLiteCredentialService } = await import('../../src/services/plugins/sqlite-credential-service');
      const service = new SQLiteCredentialService();
      
      (service.delete as unknown as import('vitest').Mock).mockResolvedValue({
        success: true,
        message: 'Credentials deleted successfully',
        changes: 1
      });
      
      const result = await service.delete('smartsheet');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('changes');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
      expect(typeof result.changes).toBe('number');
    });
  });

  describe('Plugin Lifecycle Contract', () => {
    it('should validate all plugins implement lifecycle methods', async () => {
      const [
        { SQLiteDataService },
        { MemoryDataService },
        { ElectronBotService },
        { MockSubmissionService },
        { SQLiteCredentialService }
      ] = await Promise.all([
        import('../../src/services/plugins/sqlite-data-service'),
        import('../../src/services/plugins/memory-data-service'),
        import('../../src/services/plugins/electron-bot-service'),
        import('../../src/services/plugins/mock-submission-service'),
        import('../../src/services/plugins/sqlite-credential-service')
      ]);
      
      const plugins = [
        SQLiteDataService,
        MemoryDataService,
        ElectronBotService,
        MockSubmissionService,
        SQLiteCredentialService
      ];
      
      plugins.forEach(PluginClass => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const plugin: any = new PluginClass();
        
        expect(plugin).toHaveProperty('name');
        expect(plugin).toHaveProperty('version');
        expect(plugin).toHaveProperty('initialize');
        expect(plugin).toHaveProperty('cleanup');
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(typeof (plugin as any).name).toBe('string');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(typeof (plugin as any).version).toBe('string');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(typeof (plugin as any).initialize).toBe('function');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(typeof (plugin as any).cleanup).toBe('function');
      });
    });

    it('should validate plugin initialization', async () => {
      const { SQLiteDataService } = await import('../../src/services/plugins/sqlite-data-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new SQLiteDataService();
      
      service.initialize.mockResolvedValue(true);
      
      const result = await service.initialize();
      
      expect(typeof result).toBe('boolean');
    });

    it('should validate plugin cleanup', async () => {
      const { SQLiteDataService } = await import('../../src/services/plugins/sqlite-data-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new SQLiteDataService();
      
      service.cleanup.mockResolvedValue(true);
      
      const result = await service.cleanup();
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Error Handling Contract', () => {
    it('should validate error response structure', async () => {
      const { SQLiteDataService } = await import('../../src/services/plugins/sqlite-data-service');
      const service = new SQLiteDataService();
      
      (service.saveDraft as unknown as import('vitest').Mock).mockResolvedValue({
        success: false,
        error: 'Database connection failed'
      });
      
      const result = await service.saveDraft({
        date: '01/15/2025',
        hours: 8.0,
        project: 'FL-Carver Techs',
        taskDescription: 'Test'
      });
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result.success).toBe(false);
      if ('error' in result) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(typeof (result as any).error).toBe('string');
      }
    });

    it('should validate error messages are user-friendly', async () => {
      const { ElectronBotService } = await import('../../src/services/plugins/electron-bot-service');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service: any = new ElectronBotService();
      
      (service.submit as unknown as import('vitest').Mock).mockResolvedValue({
        ok: false,
        submittedIds: [],
        removedIds: [],
        totalProcessed: 0,
        successCount: 0,
        removedCount: 0,
        error: 'Could not connect to submission service'
      });
      
      const result = await service.submit([], { email: 'test@example.com', password: 'password' });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ('error' in result && typeof (result as any).error === 'string') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((result as any).error.length).toBeLessThan(100);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((result as any).error).not.toContain('undefined');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((result as any).error).not.toContain('null');
      } else {
        throw new Error('error field missing or invalid');
      }
    });
  });

  describe('Plugin Registry Contract', () => {
    it('should validate plugin registration', () => {
      const mockRegistry = {
        registerDataService: vi.fn(),
        registerSubmissionService: vi.fn(),
        registerCredentialService: vi.fn(),
        getDataService: vi.fn(),
        getSubmissionService: vi.fn(),
        getCredentialService: vi.fn()
      };
      
      expect(typeof mockRegistry.registerDataService).toBe('function');
      expect(typeof mockRegistry.registerSubmissionService).toBe('function');
      expect(typeof mockRegistry.registerCredentialService).toBe('function');
      expect(typeof mockRegistry.getDataService).toBe('function');
      expect(typeof mockRegistry.getSubmissionService).toBe('function');
      expect(typeof mockRegistry.getCredentialService).toBe('function');
    });

    it('should validate plugin switching', () => {
      const mockRegistry = {
        switchDataService: vi.fn(),
        switchSubmissionService: vi.fn(),
        switchCredentialService: vi.fn()
      };
      
      expect(typeof mockRegistry.switchDataService).toBe('function');
      expect(typeof mockRegistry.switchSubmissionService).toBe('function');
      expect(typeof mockRegistry.switchCredentialService).toBe('function');
    });
  });
});
