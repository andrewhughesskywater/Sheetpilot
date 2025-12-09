import { describe, it, expect, vi } from 'vitest';
import { normalizeRowData, normalizeTrailingBlank, type TimesheetRow } from '../../src/logic/timesheet-normalization';
import { projectNeedsTools as _projectNeedsTools, toolNeedsChargeCode as _toolNeedsChargeCode } from '../../src/logic/dropdown-logic';

// Mock dropdown-logic
vi.mock('../../src/logic/dropdown-logic', () => ({
  projectNeedsTools: vi.fn((project?: string) => {
    // Mock: projects that need tools
    return project === 'ProjectWithTools';
  }),
  toolNeedsChargeCode: vi.fn((tool?: string) => {
    // Mock: tools that need charge codes
    return tool === 'ToolWithChargeCode';
  })
}));

describe('timesheet-normalization', () => {
  describe('normalizeRowData', () => {
    it('should clear tool and chargeCode when project does not need tools', () => {
      const row: TimesheetRow = {
        project: 'ProjectWithoutTools',
        tool: 'SomeTool',
        chargeCode: 'SomeCode'
      };

      const normalized = normalizeRowData(row);

      expect(normalized.tool).toBeNull();
      expect(normalized.chargeCode).toBeNull();
      expect(normalized.project).toBe('ProjectWithoutTools');
    });

    it('should preserve tool and chargeCode when project needs tools', () => {
      const row: TimesheetRow = {
        project: 'ProjectWithTools',
        tool: 'SomeTool',
        chargeCode: 'SomeCode'
      };

      const normalized = normalizeRowData(row);

      expect(normalized.tool).toBe('SomeTool');
      // chargeCode is cleared because 'SomeTool' doesn't need a charge code per the mock
      expect(normalized.chargeCode).toBeNull();
    });

    it('should clear chargeCode when tool does not need charge code', () => {
      const row: TimesheetRow = {
        project: 'ProjectWithTools',
        tool: 'ToolWithoutChargeCode',
        chargeCode: 'SomeCode'
      };

      const normalized = normalizeRowData(row);

      expect(normalized.tool).toBe('ToolWithoutChargeCode');
      expect(normalized.chargeCode).toBeNull();
    });

    it('should preserve chargeCode when tool needs charge code', () => {
      const row: TimesheetRow = {
        project: 'ProjectWithTools',
        tool: 'ToolWithChargeCode',
        chargeCode: 'SomeCode'
      };

      const normalized = normalizeRowData(row);

      expect(normalized.tool).toBe('ToolWithChargeCode');
      expect(normalized.chargeCode).toBe('SomeCode');
    });

    it('should handle row with no project', () => {
      const row: TimesheetRow = {
        tool: 'SomeTool',
        chargeCode: 'SomeCode'
      };

      const normalized = normalizeRowData(row);

      expect(normalized.tool).toBeNull();
      expect(normalized.chargeCode).toBeNull();
    });

    it('should preserve all other fields', () => {
      const row: TimesheetRow = {
        id: 1,
        date: '2025-01-15',
        timeIn: '08:00',
        timeOut: '17:00',
        project: 'ProjectWithTools',
        tool: 'ToolWithChargeCode',
        chargeCode: 'CC1',
        taskDescription: 'Test task'
      };

      const normalized = normalizeRowData(row);

      expect(normalized.id).toBe(1);
      expect(normalized.date).toBe('2025-01-15');
      expect(normalized.timeIn).toBe('08:00');
      expect(normalized.timeOut).toBe('17:00');
      expect(normalized.taskDescription).toBe('Test task');
    });

    it('should return new object (immutable)', () => {
      const row: TimesheetRow = {
        project: 'ProjectWithTools',
        tool: 'SomeTool'
      };

      const normalized = normalizeRowData(row);

      expect(normalized).not.toBe(row);
    });
  });

  describe('normalizeTrailingBlank', () => {
    it('should ensure exactly one blank row at end', () => {
      const rows: TimesheetRow[] = [
        { date: '2025-01-15', project: 'Project A' },
        { date: '2025-01-16', project: 'Project B' }
      ];

      const normalized = normalizeTrailingBlank(rows);

      expect(normalized).toHaveLength(3);
      expect(normalized[0].date).toBe('2025-01-15');
      expect(normalized[1].date).toBe('2025-01-16');
      expect(normalized[2]).toEqual({});
    });

    it('should remove multiple trailing empty rows', () => {
      const rows: TimesheetRow[] = [
        { date: '2025-01-15', project: 'Project A' },
        {},
        {},
        {}
      ];

      const normalized = normalizeTrailingBlank(rows);

      expect(normalized).toHaveLength(2);
      expect(normalized[0].date).toBe('2025-01-15');
      expect(normalized[1]).toEqual({});
    });

    it('should handle all empty rows', () => {
      const rows: TimesheetRow[] = [{}, {}, {}];

      const normalized = normalizeTrailingBlank(rows);

      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toEqual({});
    });

    it('should handle empty array', () => {
      const rows: TimesheetRow[] = [];

      const normalized = normalizeTrailingBlank(rows);

      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toEqual({});
    });

    it('should detect non-empty rows by any field', () => {
      const rows: TimesheetRow[] = [
        { date: '2025-01-15' },
        { timeIn: '08:00' },
        { timeOut: '17:00' },
        { project: 'Project A' },
        { tool: 'Tool 1' },
        { chargeCode: 'CC1' },
        { taskDescription: 'Task' },
        {}
      ];

      const normalized = normalizeTrailingBlank(rows);

      expect(normalized).toHaveLength(8);
      expect(normalized[7]).toEqual({});
    });

    it('should preserve rows with partial data', () => {
      const rows: TimesheetRow[] = [
        { date: '2025-01-15', project: 'Project A' },
        { date: '2025-01-16' }, // Partial data
        {}
      ];

      const normalized = normalizeTrailingBlank(rows);

      expect(normalized).toHaveLength(3);
      expect(normalized[1].date).toBe('2025-01-16');
    });
  });
});
