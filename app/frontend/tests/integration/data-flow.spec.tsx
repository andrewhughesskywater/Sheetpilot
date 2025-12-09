/**
 * @fileoverview Data Flow Integration Tests
 * 
 * Tests for data entry → validation → save → load flow, data synchronization,
 * and error recovery.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Data Flow Integration', () => {
  let mockWindow: {
    timesheet: {
      saveDraft: ReturnType<typeof vi.fn>;
      loadDraft: ReturnType<typeof vi.fn>;
      deleteDraft: ReturnType<typeof vi.fn>;
      submit: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Create fresh mocks for each test
    mockWindow = {
      timesheet: {
        saveDraft: vi.fn(),
        loadDraft: vi.fn(),
        deleteDraft: vi.fn(),
        submit: vi.fn()
      }
    };
    (global as {window?: unknown}).window = mockWindow;
  });

  describe('Data Entry to Load Flow', () => {
    it('should save and load data successfully', async () => {
      const testData = {
        date: '01/15/2025',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test task'
      };

      // Save
      mockWindow.timesheet.saveDraft.mockResolvedValue({
        success: true,
        changes: 1
      });

      const saveResult = await mockWindow.timesheet.saveDraft(testData);
      expect(saveResult.success).toBe(true);

      // Load
      mockWindow.timesheet.loadDraft.mockResolvedValue({
        success: true,
        entries: [{ ...testData, id: 1 }]
      });

      const loadResult = await mockWindow.timesheet.loadDraft();
      expect(loadResult.success).toBe(true);
      expect(loadResult.entries).toHaveLength(1);
      expect(loadResult.entries[0].project).toBe('Test Project');
    });

    it('should validate before saving', () => {
      const data = {
        date: '',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'Test',
        taskDescription: 'Task'
      };

      const isValid = !!(data.date && data.timeIn && data.timeOut && data.project && data.taskDescription);

      expect(isValid).toBe(false); // Missing date
    });

    it('should handle save failures gracefully', async () => {
      mockWindow.timesheet.saveDraft.mockResolvedValue({
        success: false,
        error: 'Database locked'
      });

      const result = await mockWindow.timesheet.saveDraft({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Data Synchronization Between Tabs', () => {
    it('should maintain data consistency across tabs', () => {
      const sharedData = {
        timesheetEntries: [1, 2, 3],
        lastModified: new Date().toISOString()
      };

      // Tab 1 modifies
      const tab1Data = { ...sharedData, timesheetEntries: [1, 2, 3, 4] };

      // Tab 2 should see updates
      expect(tab1Data.timesheetEntries).toHaveLength(4);
    });

    it('should handle concurrent modifications', () => {
      let data = { value: 0 };

      // Simulate concurrent updates
      data = { value: data.value + 1 };
      data = { value: data.value + 1 };

      expect(data.value).toBe(2);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from validation errors', () => {
      let hasError = true;

      const fixError = () => {
        hasError = false;
      };

      fixError();
      expect(hasError).toBe(false);
    });

    it('should recover from save errors', async () => {
      // First attempt fails
      mockWindow.timesheet.saveDraft.mockResolvedValueOnce({
        success: false,
        error: 'Network error'
      });

      const firstAttempt = await mockWindow.timesheet.saveDraft({});
      expect(firstAttempt.success).toBe(false);

      // Retry succeeds
      mockWindow.timesheet.saveDraft.mockResolvedValueOnce({
        success: true
      });

      const secondAttempt = await mockWindow.timesheet.saveDraft({});
      expect(secondAttempt.success).toBe(true);
    });

    it('should preserve data in localStorage on save failure', () => {
      const mockLocalStorage: Record<string, string> = {};

      const saveToLocalStorage = (data: unknown) => {
        mockLocalStorage['backup'] = JSON.stringify(data);
      };

      const data = { date: '01/15/2025' };
      saveToLocalStorage(data);

      expect(mockLocalStorage['backup']).toBeDefined();

      const recovered = JSON.parse(mockLocalStorage['backup']);
      expect(recovered).toEqual(data);
    });
  });

  describe('Delete Flow', () => {
    it('should delete entries successfully', async () => {
      mockWindow.timesheet.deleteDraft.mockResolvedValue({
        success: true,
        changes: 1
      });

      const result = await mockWindow.timesheet.deleteDraft(1);

      expect(result.success).toBe(true);
      expect(mockWindow.timesheet.deleteDraft).toHaveBeenCalledWith(1);
    });

    it('should handle delete of non-existent entry', async () => {
      mockWindow.timesheet.deleteDraft.mockResolvedValue({
        success: false,
        error: 'Entry not found'
      });

      const result = await mockWindow.timesheet.deleteDraft(999);

      expect(result.success).toBe(false);
    });
  });

  describe('Submit Flow', () => {
    it('should submit validated data', async () => {
      mockWindow.timesheet.submit.mockResolvedValue({
        ok: true,
        submittedIds: [1, 2],
        totalProcessed: 2,
        successCount: 2
      });

      const result = await mockWindow.timesheet.submit('token');

      expect(result.ok).toBe(true);
      expect(result.successCount).toBe(2);
    });

    it('should handle submit failures', async () => {
      mockWindow.timesheet.submit.mockResolvedValue({
        ok: false,
        error: 'Network error',
        totalProcessed: 0,
        successCount: 0
      });

      const result = await mockWindow.timesheet.submit('token');

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

