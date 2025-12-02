import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryDataService } from '../../../src/services/plugins/memory-data-service';
import type { TimesheetEntry } from '../../../../shared/contracts/IDataService';

describe('MemoryDataService', () => {
  let service: MemoryDataService;

  beforeEach(() => {
    service = new MemoryDataService();
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(service.metadata.name).toBe('memory');
      expect(service.metadata.version).toBe('1.1.2');
      expect(service.metadata.author).toBe('Andrew Hughes');
    });
  });

  describe('saveDraft', () => {
    it('should save new draft entry', async () => {
      const entry: TimesheetEntry = {
        date: '2025-01-15',
        timeIn: '08:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test Task'
      };

      const result = await service.saveDraft(entry);

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.changes).toBe(1);
    });

    it('should update existing draft entry', async () => {
      const entry: TimesheetEntry = {
        date: '2025-01-15',
        timeIn: '08:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test Task'
      };

      const saveResult = await service.saveDraft(entry);
      expect(saveResult.success).toBe(true);
      const id = saveResult.id!;

      const updatedEntry: TimesheetEntry = {
        ...entry,
        id,
        project: 'Updated Project'
      };

      const updateResult = await service.saveDraft(updatedEntry);
      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toBe(1);
    });

    it('should return error when required fields are missing', async () => {
      const entry: Partial<TimesheetEntry> = {
        timeIn: '08:00',
        timeOut: '17:00'
      };

      const result = await service.saveDraft(entry as TimesheetEntry);
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should return error when updating non-existent entry', async () => {
      const entry: TimesheetEntry = {
        id: 999,
        date: '2025-01-15',
        timeIn: '08:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test Task'
      };

      const result = await service.saveDraft(entry);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Entry not found');
    });
  });

  describe('loadDraft', () => {
    it('should return empty array when no entries', async () => {
      const result = await service.loadDraft();

      expect(result.success).toBe(true);
      expect(result.entries).toBeDefined();
      expect(result.entries?.length).toBeGreaterThanOrEqual(0);
    });

    it('should return saved entries', async () => {
      const entry: TimesheetEntry = {
        date: '2025-01-15',
        timeIn: '08:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test Task'
      };

      await service.saveDraft(entry);
      const result = await service.loadDraft();

      expect(result.success).toBe(true);
      expect(result.entries).toBeDefined();
      expect(result.entries?.length).toBeGreaterThan(0);
    });
  });

  describe('deleteDraft', () => {
    it('should delete existing entry', async () => {
      const entry: TimesheetEntry = {
        date: '2025-01-15',
        timeIn: '08:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test Task'
      };

      const saveResult = await service.saveDraft(entry);
      const id = saveResult.id!;

      const deleteResult = await service.deleteDraft(id);
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.changes).toBe(1);
    });

    it('should return error when deleting non-existent entry', async () => {
      const result = await service.deleteDraft(999);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Entry not found');
    });
  });

  describe('archiveEntry', () => {
    it('should archive entry', async () => {
      const entry: TimesheetEntry = {
        date: '2025-01-15',
        timeIn: '08:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test Task'
      };

      const saveResult = await service.saveDraft(entry);
      const id = saveResult.id!;

      const archiveResult = await service.archiveEntry(id);
      expect(archiveResult.success).toBe(true);
    });

    it('should return error when archiving non-existent entry', async () => {
      const result = await service.archiveEntry(999);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Entry not found');
    });
  });

  describe('loadArchive', () => {
    it('should return empty array when no archived entries', async () => {
      const result = await service.loadArchive();

      expect(result.success).toBe(true);
      expect(result.entries).toEqual([]);
    });

    it('should return archived entries', async () => {
      const entry: TimesheetEntry = {
        date: '2025-01-15',
        timeIn: '08:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test Task'
      };

      const saveResult = await service.saveDraft(entry);
      const id = saveResult.id!;
      await service.archiveEntry(id);

      const result = await service.loadArchive();
      expect(result.success).toBe(true);
      expect(result.entries?.length).toBeGreaterThan(0);
    });
  });
});


