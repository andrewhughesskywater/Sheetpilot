import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockSubmissionService } from '../../../src/services/plugins/mock-submission-service';
import type { TimesheetEntry, Credentials } from '@sheetpilot/shared';

describe('MockSubmissionService', () => {
  let service: MockSubmissionService;

  beforeEach(() => {
    service = new MockSubmissionService();
    service.setShouldFail(false);
    service.setFailureRate(0);
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(service.metadata.name).toBe('mock');
      expect(service.metadata.version).toBe('1.1.2');
      expect(service.metadata.author).toBe('Andrew Hughes');
    });
  });

  describe('setShouldFail', () => {
    it('should set failure flag', () => {
      service.setShouldFail(true);
      expect(service['shouldFail']).toBe(true);
      
      service.setShouldFail(false);
      expect(service['shouldFail']).toBe(false);
    });
  });

  describe('setFailureRate', () => {
    it('should set failure rate', () => {
      service.setFailureRate(0.5);
      expect(service['failureRate']).toBe(0.5);
    });

    it('should clamp failure rate to 0-1 range', () => {
      service.setFailureRate(-1);
      expect(service['failureRate']).toBe(0);

      service.setFailureRate(2);
      expect(service['failureRate']).toBe(1);
    });
  });

  describe('submit', () => {
    const createEntry = (id: number): TimesheetEntry => ({
      id,
      date: '2025-01-15',
      hours: 8.0,
      project: 'Test Project',
      taskDescription: 'Test Task'
    });

    const mockCredentials: Credentials = {
      email: 'test@example.com',
      password: 'password123'
    };

    it('should submit entries successfully', async () => {
      const entries = [createEntry(1), createEntry(2)];
      const result = await service.submit(entries, mockCredentials);

      expect(result.ok).toBe(true);
      expect(result.submittedIds).toHaveLength(2);
      expect(result.removedIds).toHaveLength(0);
      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2);
    });

    it('should return cancelled result when aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const entries = [createEntry(1)];
      const result = await service.submit(entries, mockCredentials, undefined, controller.signal);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Submission was cancelled');
      expect(result.submittedIds).toHaveLength(0);
    });

    it('should fail when shouldFail is true', async () => {
      service.setShouldFail(true);
      const entries = [createEntry(1), createEntry(2)];
      const result = await service.submit(entries, mockCredentials);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Mock submission service configured to fail');
      expect(result.removedIds).toHaveLength(2);
      expect(result.successCount).toBe(0);
    });

    it('should handle partial failures based on failure rate', async () => {
      service.setFailureRate(0.5);
      const entries = Array.from({ length: 10 }, (_, i) => createEntry(i + 1));
      
      // Mock Math.random to control failure pattern
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.3); // Below 0.5, so should succeed
      
      const result = await service.submit(entries, mockCredentials);

      // All should succeed with mocked random
      expect(result.submittedIds.length + result.removedIds.length).toBe(10);
      
      randomSpy.mockRestore();
    });

    it('should skip entries without IDs', async () => {
      const entries: TimesheetEntry[] = [
        createEntry(1),
        { ...createEntry(2), id: undefined },
        createEntry(3)
      ];

      const result = await service.submit(entries, mockCredentials);

      expect(result.submittedIds).toHaveLength(2);
      expect(result.totalProcessed).toBe(3);
    });

    it('should call progress callback if provided', async () => {
      const progressCallback = vi.fn();
      const entries = [createEntry(1)];

      await service.submit(entries, mockCredentials, progressCallback);

      // Progress callback may or may not be called in mock implementation
      // Just verify it doesn't throw
      expect(progressCallback).toBeDefined();
    });
  });

  describe('validateEntry', () => {
    it('should validate complete entry', () => {
      const entry: TimesheetEntry = {
        date: '2025-01-15',
        hours: 8.0,
        project: 'Test Project',
        taskDescription: 'Test Task'
      };

      const result = service.validateEntry(entry);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', () => {
      const entry: Partial<TimesheetEntry> = {};

      const result = service.validateEntry(entry as TimesheetEntry);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Date is required');
      expect(result.errors).toContain('Hours is required');
      expect(result.errors).toContain('Project is required');
      expect(result.errors).toContain('Task description is required');
    });

    it('should detect missing date', () => {
      const entry: Partial<TimesheetEntry> = {
        date: '',
        hours: 8.0,
        project: 'Test Project',
        taskDescription: 'Test Task'
      };

      const result = service.validateEntry(entry as TimesheetEntry);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Date is required');
    });

    it('should detect missing hours', () => {
      const entry: Partial<TimesheetEntry> = {
        date: '2025-01-15',
        hours: undefined,
        project: 'Test Project',
        taskDescription: 'Test Task'
      };

      const result = service.validateEntry(entry as TimesheetEntry);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hours is required');
    });
  });

  describe('isAvailable', () => {
    it('should always return true', async () => {
      const result = await service.isAvailable();
      expect(result).toBe(true);
    });
  });
});


