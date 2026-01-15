import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processEntriesByQuarter, getQuarterForDate, groupEntriesByQuarter, createFormConfig, checkAborted } from '@sheetpilot/bot';
import { botLogger } from '@sheetpilot/shared/logger';
import type { TimesheetEntry } from '@sheetpilot/shared';

// Mock dependencies
vi.mock('@sheetpilot/bot', async () => {
  const actual = await vi.importActual('@sheetpilot/bot');
  return {
    ...actual,
    getQuarterForDate: vi.fn(),
    groupEntriesByQuarter: vi.fn(),
    createFormConfig: vi.fn(),
    checkAborted: vi.fn()
  };
});
vi.mock('@sheetpilot/shared/logger', () => ({
  botLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    verbose: vi.fn()
  }
}));

describe('quarter-processing', () => {
  const mockQuarterDef = {
    id: 'Q1-2025',
    name: 'Q1 2025',
    startDate: '2025-01-01',
    endDate: '2025-03-31',
    formUrl: 'https://app.smartsheet.com/b/form/q1-2025',
    formId: 'q1-2025'
  };

  const mockFormConfig = {
    BASE_URL: 'https://app.smartsheet.com',
    FORM_ID: 'q1-2025',
    SUBMISSION_ENDPOINT: 'https://app.smartsheet.com/api/submit/q1-2025',
    SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: ['**app.smartsheet.com/**']
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getQuarterForDate).mockReturnValue(mockQuarterDef);
    vi.mocked(groupEntriesByQuarter).mockReturnValue(new Map([['Q1-2025', []]]));
    vi.mocked(createFormConfig).mockReturnValue(mockFormConfig);
    vi.mocked(checkAborted).mockReturnValue(undefined);
  });

  describe('processEntriesByQuarter', () => {
    const createEntry = (id: number, date: string): TimesheetEntry => ({
      id,
      date,
      hours: 8.0,
      project: 'Test Project',
      taskDescription: 'Test Task'
    });

    const createConfig = (overrides = {}) => ({
      toBotRow: vi.fn((entry: TimesheetEntry) => ({
        date: entry.date,
        project: entry.project
      })),
      runBot: vi.fn().mockResolvedValue({
        ok: true,
        submitted: [0],
        errors: []
      }),
      email: 'test@example.com',
      password: 'password123',
      ...overrides
    });

    it('should process entries grouped by quarter', async () => {
      const entries = [
        createEntry(1, '2025-01-15'),
        createEntry(2, '2025-01-16')
      ];

      vi.mocked(groupEntriesByQuarter).mockReturnValue(
        new Map([['Q1-2025', entries]])
      );

      const config = createConfig({
        runBot: vi.fn().mockResolvedValue({
          ok: true,
          submitted: [0, 1], // Both entries submitted
          errors: []
        })
      });
      const result = await processEntriesByQuarter(entries, config);

      expect(result.ok).toBe(true);
      expect(result.submittedIds).toEqual([1, 2]);
      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2);
    });

    it('should handle multiple quarters', async () => {
      const q1Entries = [createEntry(1, '2025-01-15')];
      const q2Entries = [createEntry(2, '2025-04-15')];

      const q2Def = { ...mockQuarterDef, id: 'Q2-2025', formId: 'q2-2025' };
      const q2Config = { ...mockFormConfig, FORM_ID: 'q2-2025' };

      vi.mocked(getQuarterForDate).mockImplementation((date: string) => {
        if (date.startsWith('2025-01')) return mockQuarterDef;
        if (date.startsWith('2025-04')) return q2Def;
        return null;
      });

      vi.mocked(groupEntriesByQuarter).mockReturnValue(
        new Map([
          ['Q1-2025', q1Entries],
          ['Q2-2025', q2Entries]
        ])
      );

      vi.mocked(createFormConfig).mockImplementation((url: string, formId: string) => {
        if (formId === 'q2-2025') return q2Config;
        return mockFormConfig;
      });

      const config = createConfig();
      const result = await processEntriesByQuarter([...q1Entries, ...q2Entries], config);

      expect(result.ok).toBe(true);
      expect(result.submittedIds).toEqual([1, 2]);
      expect(config.runBot).toHaveBeenCalledTimes(2);
    });

    it('should handle entries without quarter definition', async () => {
      const entries = [createEntry(1, '2025-01-15')];

      vi.mocked(getQuarterForDate).mockReturnValue(null);
      vi.mocked(groupEntriesByQuarter).mockReturnValue(
        new Map([['unknown', entries]])
      );

      const config = createConfig();
      const result = await processEntriesByQuarter(entries, config);

      expect(result.ok).toBe(false);
      expect(result.removedIds).toEqual([1]);
      expect(botLogger.error).toHaveBeenCalledWith(
        'Could not determine quarter for entries',
        expect.any(Object)
      );
    });

    it('should use mock website configuration when useMockWebsite is true', async () => {
      const entries = [createEntry(1, '2025-01-15')];
      const originalEnv = process.env['MOCK_WEBSITE_URL'];
      const originalFormId = process.env['MOCK_FORM_ID'];

      process.env['MOCK_WEBSITE_URL'] = 'http://localhost:3000';
      process.env['MOCK_FORM_ID'] = 'mock-form-id';

      vi.mocked(groupEntriesByQuarter).mockReturnValue(
        new Map([['Q1-2025', entries]])
      );

      const config = createConfig({ useMockWebsite: true });
      await processEntriesByQuarter(entries, config);

      expect(botLogger.info).toHaveBeenCalledWith(
        'Using mock website for submission',
        expect.objectContaining({
          mockBaseUrl: 'http://localhost:3000',
          mockFormId: 'mock-form-id'
        })
      );

      // Restore env
      if (originalEnv) process.env['MOCK_WEBSITE_URL'] = originalEnv;
      else delete process.env['MOCK_WEBSITE_URL'];
      if (originalFormId) process.env['MOCK_FORM_ID'] = originalFormId;
      else delete process.env['MOCK_FORM_ID'];
    });

    it('should check abort signal before processing each quarter', async () => {
      const entries = [createEntry(1, '2025-01-15')];
      const abortSignal = new AbortController().signal;

      vi.mocked(groupEntriesByQuarter).mockReturnValue(
        new Map([['Q1-2025', entries]])
      );

      const config = createConfig({ abortSignal });
      await processEntriesByQuarter(entries, config);

      expect(checkAborted).toHaveBeenCalledWith(abortSignal, 'Submission (quarter Q1-2025)');
    });

    it('should throw error when aborted during processing', async () => {
      const entries = [createEntry(1, '2025-01-15')];
      const abortSignal = new AbortController().signal;

      vi.mocked(groupEntriesByQuarter).mockReturnValue(
        new Map([['Q1-2025', entries]])
      );

      vi.mocked(checkAborted).mockImplementation(() => {
        throw new Error('Submission was cancelled');
      });

      const config = createConfig({ abortSignal });

      await expect(processEntriesByQuarter(entries, config)).rejects.toThrow('Submission was cancelled');
      expect(botLogger.info).toHaveBeenCalledWith(
        'Submission aborted during quarter processing',
        { quarterId: 'Q1-2025' }
      );
    });

    it('should map bot indices to entry IDs correctly', async () => {
      const entries = [
        createEntry(1, '2025-01-15'),
        createEntry(2, '2025-01-16'),
        createEntry(3, '2025-01-17')
      ];

      vi.mocked(groupEntriesByQuarter).mockReturnValue(
        new Map([['Q1-2025', entries]])
      );

      const config = createConfig({
        runBot: vi.fn().mockResolvedValue({
          ok: true,
          submitted: [0, 2], // First and third entries
          errors: [[1, 'Error']] // Second entry failed
        })
      });

      const result = await processEntriesByQuarter(entries, config);

      expect(result.submittedIds).toEqual([1, 3]);
      expect(result.removedIds).toEqual([2]);
      expect(result.successCount).toBe(2);
      expect(result.removedCount).toBe(1);
    });

    it('should filter out invalid bot indices', async () => {
      const entries = [createEntry(1, '2025-01-15')];

      vi.mocked(groupEntriesByQuarter).mockReturnValue(
        new Map([['Q1-2025', entries]])
      );

      const config = createConfig({
        runBot: vi.fn().mockResolvedValue({
          ok: true,
          submitted: [-1, 0, 5], // Invalid indices
          errors: []
        })
      });

      const result = await processEntriesByQuarter(entries, config);

      expect(result.submittedIds).toEqual([1]); // Only valid index 0 maps to ID 1
    });

    it('should handle bot errors', async () => {
      const entries = [createEntry(1, '2025-01-15')];

      vi.mocked(groupEntriesByQuarter).mockReturnValue(
        new Map([['Q1-2025', entries]])
      );

      const config = createConfig({
        runBot: vi.fn().mockResolvedValue({
          ok: false,
          submitted: [],
          errors: [[0, 'Bot error']]
        })
      });

      const result = await processEntriesByQuarter(entries, config);

      expect(result.ok).toBe(false);
      expect(botLogger.error).toHaveBeenCalledWith(
        'Bot returned errors during submission',
        expect.objectContaining({
          errorCount: 1
        })
      );
    });

    it('should call progress callback when provided', async () => {
      const entries = [createEntry(1, '2025-01-15')];
      const progressCallback = vi.fn();

      vi.mocked(groupEntriesByQuarter).mockReturnValue(
        new Map([['Q1-2025', entries]])
      );

      const config = createConfig({
        progressCallback,
        runBot: vi.fn().mockResolvedValue({
          ok: true,
          submitted: [0],
          errors: []
        })
      });

      await processEntriesByQuarter(entries, config);

      // Progress callback should be passed to runBot
      expect(config.runBot).toHaveBeenCalledWith(
        expect.any(Array),
        'test@example.com',
        'password123',
        expect.any(Object),
        progressCallback,
        undefined,
        undefined
      );
    });

    it('should handle entries without IDs', async () => {
      const entries: TimesheetEntry[] = [
        { ...createEntry(1, '2025-01-15'), id: undefined },
        createEntry(2, '2025-01-16')
      ];

      vi.mocked(groupEntriesByQuarter).mockReturnValue(
        new Map([['Q1-2025', entries]])
      );

      const config = createConfig({
        runBot: vi.fn().mockResolvedValue({
          ok: true,
          submitted: [0, 1], // Both entries submitted
          errors: []
        })
      });
      const result = await processEntriesByQuarter(entries, config);

      // Entry without ID should not be included in submittedIds
      expect(result.submittedIds).toEqual([2]);
    });

    it('should log debug information about entries', async () => {
      const entries = [createEntry(1, '2025-01-15')];

      const config = createConfig();
      await processEntriesByQuarter(entries, config);

      expect(botLogger.debug).toHaveBeenCalledWith(
        'Checking entries for quarter assignment',
        expect.any(Object)
      );
      expect(botLogger.verbose).toHaveBeenCalledWith(
        'Entries grouped by quarter',
        { quarterCount: 1 }
      );
    });
  });
});

