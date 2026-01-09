import { describe, it, expect } from 'vitest';
import { timeRangesOverlap, hasTimeOverlapWithPreviousEntries } from '@/components/timesheet/timesheet.schema';
import { validateField } from '@/components/timesheet/timesheet.validation';
import type { TimesheetRow } from '@/components/timesheet/timesheet.schema';

describe('timeRangesOverlap', () => {
  it('should detect overlapping time ranges', () => {
    // Entry A: 09:00-12:00, Entry B: 11:00-14:00
    expect(timeRangesOverlap('09:00', '12:00', '11:00', '14:00')).toBe(true);
  });

  it('should detect overlapping time ranges with complete overlap', () => {
    // Entry A: 09:00-17:00, Entry B: 10:00-12:00 (B is completely inside A)
    expect(timeRangesOverlap('09:00', '17:00', '10:00', '12:00')).toBe(true);
  });

  it('should detect overlapping time ranges with reversed order', () => {
    // Entry A: 10:00-12:00, Entry B: 09:00-17:00 (A is completely inside B)
    expect(timeRangesOverlap('10:00', '12:00', '09:00', '17:00')).toBe(true);
  });

  it('should allow adjacent time ranges (no overlap)', () => {
    // Entry A: 09:00-12:00, Entry B: 12:00-15:00
    expect(timeRangesOverlap('09:00', '12:00', '12:00', '15:00')).toBe(false);
  });

  it('should allow adjacent time ranges in reverse order', () => {
    // Entry A: 12:00-15:00, Entry B: 09:00-12:00
    expect(timeRangesOverlap('12:00', '15:00', '09:00', '12:00')).toBe(false);
  });

  it('should detect exact duplicate time ranges', () => {
    // Entry A: 09:00-12:00, Entry B: 09:00-12:00
    expect(timeRangesOverlap('09:00', '12:00', '09:00', '12:00')).toBe(true);
  });

  it('should allow completely separate time ranges', () => {
    // Entry A: 09:00-12:00, Entry B: 13:00-15:00
    expect(timeRangesOverlap('09:00', '12:00', '13:00', '15:00')).toBe(false);
  });

  it('should detect partial overlap at the start', () => {
    // Entry A: 09:00-11:00, Entry B: 10:00-12:00
    expect(timeRangesOverlap('09:00', '11:00', '10:00', '12:00')).toBe(true);
  });

  it('should detect partial overlap at the end', () => {
    // Entry A: 10:00-12:00, Entry B: 09:00-11:00
    expect(timeRangesOverlap('10:00', '12:00', '09:00', '11:00')).toBe(true);
  });
});

describe('hasTimeOverlapWithPreviousEntries', () => {
  it('should detect overlap with previous entry on same date', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
      { date: '01/15/2024', timeIn: '11:00', timeOut: '14:00', project: 'Project B', taskDescription: 'Task 2' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(1, rows)).toBe(true);
  });

  it('should allow non-overlapping entries on same date', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
      { date: '01/15/2024', timeIn: '13:00', timeOut: '15:00', project: 'Project B', taskDescription: 'Task 2' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(1, rows)).toBe(false);
  });

  it('should allow adjacent time ranges on same date', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
      { date: '01/15/2024', timeIn: '12:00', timeOut: '15:00', project: 'Project B', taskDescription: 'Task 2' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(1, rows)).toBe(false);
  });

  it('should allow overlapping times on different dates', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
      { date: '01/16/2024', timeIn: '11:00', timeOut: '14:00', project: 'Project B', taskDescription: 'Task 2' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(1, rows)).toBe(false);
  });

  it('should detect exact duplicate entries', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
      { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project B', taskDescription: 'Task 2' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(1, rows)).toBe(true);
  });

  it('should check against all previous rows, not just the immediate one', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
      { date: '01/16/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project B', taskDescription: 'Task 2' },
      { date: '01/15/2024', timeIn: '11:00', timeOut: '14:00', project: 'Project C', taskDescription: 'Task 3' }
    ];
    // Row 2 (index 2) should overlap with Row 0 (index 0) on date 01/15/2024
    expect(hasTimeOverlapWithPreviousEntries(2, rows)).toBe(true);
  });

  it('should return false for first row (no previous entries)', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(0, rows)).toBe(false);
  });

  it('should skip validation if current row is missing date', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
      { timeIn: '11:00', timeOut: '14:00', project: 'Project B', taskDescription: 'Task 2' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(1, rows)).toBe(false);
  });

  it('should skip validation if current row is missing timeIn', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
      { date: '01/15/2024', timeOut: '14:00', project: 'Project B', taskDescription: 'Task 2' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(1, rows)).toBe(false);
  });

  it('should skip validation if current row is missing timeOut', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
      { date: '01/15/2024', timeIn: '11:00', project: 'Project B', taskDescription: 'Task 2' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(1, rows)).toBe(false);
  });

  it('should skip checking against previous rows with invalid data', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: '09:00', project: 'Project A', taskDescription: 'Task 1' }, // Missing timeOut
      { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project B', taskDescription: 'Task 2' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(1, rows)).toBe(false);
  });

  it('should skip checking against previous rows with invalid date format', () => {
    const rows: TimesheetRow[] = [
      { date: 'invalid', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
      { date: '01/15/2024', timeIn: '11:00', timeOut: '14:00', project: 'Project B', taskDescription: 'Task 2' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(1, rows)).toBe(false);
  });

  it('should skip checking against previous rows with invalid time format', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: 'invalid', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
      { date: '01/15/2024', timeIn: '11:00', timeOut: '14:00', project: 'Project B', taskDescription: 'Task 2' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(1, rows)).toBe(false);
  });

  it('should skip checking against previous rows where timeOut is before timeIn', () => {
    const rows: TimesheetRow[] = [
      { date: '01/15/2024', timeIn: '12:00', timeOut: '09:00', project: 'Project A', taskDescription: 'Task 1' }, // Invalid range
      { date: '01/15/2024', timeIn: '10:00', timeOut: '11:00', project: 'Project B', taskDescription: 'Task 2' }
    ];
    expect(hasTimeOverlapWithPreviousEntries(1, rows)).toBe(false);
  });
});

describe('validateField with overlap detection', () => {
  const mockRows: TimesheetRow[] = [
    { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' }
  ];

  describe('timeIn validation', () => {
    it('should return error message when timeIn creates overlap', () => {
      const rows: TimesheetRow[] = [
        ...mockRows,
        { date: '01/15/2024', timeIn: '10:00', timeOut: '14:00', project: 'Project B', taskDescription: 'Task 2' }
      ];
      const error = validateField('11:00', 1, 'timeIn', rows);
      expect(error).toBe('The time range you entered overlaps with a previous entry, please adjust your entry accordingly');
    });

    it('should return null when timeIn does not create overlap', () => {
      const rows: TimesheetRow[] = [
        ...mockRows,
        { date: '01/15/2024', timeIn: '13:00', timeOut: '15:00', project: 'Project B', taskDescription: 'Task 2' }
      ];
      const error = validateField('13:00', 1, 'timeIn', rows);
      expect(error).toBeNull();
    });

    it('should return error message for basic validation before checking overlap', () => {
      const rows: TimesheetRow[] = [
        ...mockRows,
        { date: '01/15/2024', timeOut: '14:00', project: 'Project B', taskDescription: 'Task 2' }
      ];
      const error = validateField('', 1, 'timeIn', rows);
      expect(error).toBe('Please enter start time');
    });

    it('should return error message for invalid time format before checking overlap', () => {
      const rows: TimesheetRow[] = [
        ...mockRows,
        { date: '01/15/2024', timeIn: 'invalid', timeOut: '14:00', project: 'Project B', taskDescription: 'Task 2' }
      ];
      const error = validateField('invalid', 1, 'timeIn', rows);
      expect(error).toBe('Time must be like 09:00, 800, or 1430 and in 15 minute steps');
    });
  });

  describe('timeOut validation', () => {
    it('should return error message when timeOut creates overlap', () => {
      const rows: TimesheetRow[] = [
        ...mockRows,
        { date: '01/15/2024', timeIn: '08:00', timeOut: '10:00', project: 'Project B', taskDescription: 'Task 2' }
      ];
      const error = validateField('11:00', 1, 'timeOut', rows);
      expect(error).toBe('The time range you entered overlaps with a previous entry, please adjust your entry accordingly');
    });

    it('should return null when timeOut does not create overlap', () => {
      const rows: TimesheetRow[] = [
        ...mockRows,
        { date: '01/15/2024', timeIn: '13:00', timeOut: '15:00', project: 'Project B', taskDescription: 'Task 2' }
      ];
      const error = validateField('15:00', 1, 'timeOut', rows);
      expect(error).toBeNull();
    });

    it('should return error message when timeOut is before timeIn', () => {
      const rows: TimesheetRow[] = [
        { date: '01/15/2024', timeIn: '14:00', timeOut: '17:00', project: 'Project A', taskDescription: 'Task 1' },
        { date: '01/16/2024', timeIn: '14:00', project: 'Project B', taskDescription: 'Task 2' }
      ];
      const error = validateField('10:00', 1, 'timeOut', rows);
      expect(error).toBe('End time must be after start time');
    });

    it('should check overlap after validating timeOut is after timeIn', () => {
      const rows: TimesheetRow[] = [
        { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
        { date: '01/15/2024', timeIn: '10:00', project: 'Project B', taskDescription: 'Task 2' }
      ];
      const error = validateField('11:00', 1, 'timeOut', rows);
      expect(error).toBe('The time range you entered overlaps with a previous entry, please adjust your entry accordingly');
    });
  });

  describe('edge cases', () => {
    it('should allow adjacent time ranges', () => {
      const rows: TimesheetRow[] = [
        { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
        { date: '01/15/2024', timeIn: '12:00', timeOut: '15:00', project: 'Project B', taskDescription: 'Task 2' }
      ];
      const errorTimeIn = validateField('12:00', 1, 'timeIn', rows);
      const errorTimeOut = validateField('15:00', 1, 'timeOut', rows);
      expect(errorTimeIn).toBeNull();
      expect(errorTimeOut).toBeNull();
    });

    it('should detect overlap across multiple previous entries', () => {
      const rows: TimesheetRow[] = [
        { date: '01/15/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project A', taskDescription: 'Task 1' },
        { date: '01/16/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project B', taskDescription: 'Task 2' },
        { date: '01/17/2024', timeIn: '09:00', timeOut: '12:00', project: 'Project C', taskDescription: 'Task 3' },
        { date: '01/15/2024', timeIn: '10:00', timeOut: '11:00', project: 'Project D', taskDescription: 'Task 4' }
      ];
      const error = validateField('11:00', 3, 'timeOut', rows);
      expect(error).toBe('The time range you entered overlaps with a previous entry, please adjust your entry accordingly');
    });
  });
});

