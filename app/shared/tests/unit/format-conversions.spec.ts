import { describe, it, expect } from 'vitest';
import {
  parseTimeToMinutes,
  formatMinutesToTime,
  convertDateToUSFormat,
  convertDateToISOFormat,
  normalizeDateToISO
} from '@/utils/format-conversions';

describe('format-conversions', () => {
  describe('parseTimeToMinutes', () => {
    it('should convert valid time string to minutes', () => {
      expect(parseTimeToMinutes('08:00')).toBe(480);
      expect(parseTimeToMinutes('17:30')).toBe(1050);
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('23:59')).toBe(1439);
      expect(parseTimeToMinutes('12:15')).toBe(735);
    });

    it('should throw error for invalid format - missing colon', () => {
      expect(() => parseTimeToMinutes('0800')).toThrow('Invalid time format');
    });

    it('should throw error for invalid format - too many parts', () => {
      expect(() => parseTimeToMinutes('08:00:00')).toThrow('Invalid time format');
    });

    it('should throw error for invalid format - empty hours', () => {
      expect(() => parseTimeToMinutes(':30')).toThrow('Invalid time format');
    });

    it('should throw error for invalid format - empty minutes', () => {
      expect(() => parseTimeToMinutes('08:')).toThrow('Invalid time format');
    });

    it('should throw error for non-numeric values', () => {
      expect(() => parseTimeToMinutes('ab:cd')).toThrow('Invalid time format');
      expect(() => parseTimeToMinutes('08:cd')).toThrow('Invalid time format');
      expect(() => parseTimeToMinutes('ab:30')).toThrow('Invalid time format');
    });
  });

  describe('formatMinutesToTime', () => {
    it('should convert minutes to time string', () => {
      expect(formatMinutesToTime(480)).toBe('08:00');
      expect(formatMinutesToTime(1050)).toBe('17:30');
      expect(formatMinutesToTime(0)).toBe('00:00');
      expect(formatMinutesToTime(1439)).toBe('23:59');
      expect(formatMinutesToTime(735)).toBe('12:15');
    });

    it('should handle single digit hours and minutes', () => {
      expect(formatMinutesToTime(60)).toBe('01:00');
      expect(formatMinutesToTime(65)).toBe('01:05');
      expect(formatMinutesToTime(5)).toBe('00:05');
    });

    it('should handle edge cases', () => {
      expect(formatMinutesToTime(1440)).toBe('24:00');
      expect(formatMinutesToTime(1500)).toBe('25:00');
    });
  });

  describe('convertDateToUSFormat', () => {
    it('should convert ISO date to US format', () => {
      expect(convertDateToUSFormat('2025-01-15')).toBe('01/15/2025');
      expect(convertDateToUSFormat('2024-12-31')).toBe('12/31/2024');
      expect(convertDateToUSFormat('2023-03-05')).toBe('03/05/2023');
    });

    it('should throw error for invalid format - missing dashes', () => {
      expect(() => convertDateToUSFormat('20250115')).toThrow('Invalid date format');
    });

    it('should throw error for invalid format - too many parts', () => {
      expect(() => convertDateToUSFormat('2025-01-15-extra')).toThrow('Invalid date format');
    });

    it('should throw error for invalid format - empty parts', () => {
      expect(() => convertDateToUSFormat('-01-15')).toThrow('Invalid date format');
      expect(() => convertDateToUSFormat('2025--15')).toThrow('Invalid date format');
      expect(() => convertDateToUSFormat('2025-01-')).toThrow('Invalid date format');
    });
  });

  describe('convertDateToISOFormat', () => {
    it('should convert US date to ISO format', () => {
      expect(convertDateToISOFormat('01/15/2025')).toBe('2025-01-15');
      expect(convertDateToISOFormat('12/31/2024')).toBe('2024-12-31');
      expect(convertDateToISOFormat('03/05/2023')).toBe('2023-03-05');
    });

    it('should pad single digit month and day', () => {
      expect(convertDateToISOFormat('1/5/2025')).toBe('2025-01-05');
      expect(convertDateToISOFormat('12/3/2024')).toBe('2024-12-03');
      expect(convertDateToISOFormat('3/15/2023')).toBe('2023-03-15');
    });

    it('should throw error for invalid format - missing slashes', () => {
      expect(() => convertDateToISOFormat('01152025')).toThrow('Invalid date format');
    });

    it('should throw error for invalid format - too many parts', () => {
      expect(() => convertDateToISOFormat('01/15/2025/extra')).toThrow('Invalid date format');
    });

    it('should throw error for invalid format - empty parts', () => {
      expect(() => convertDateToISOFormat('/15/2025')).toThrow('Invalid date format');
      expect(() => convertDateToISOFormat('01//2025')).toThrow('Invalid date format');
      expect(() => convertDateToISOFormat('01/15/')).toThrow('Invalid date format');
    });
  });

  describe('normalizeDateToISO', () => {
    it('should convert US format to ISO', () => {
      expect(normalizeDateToISO('01/15/2025')).toBe('2025-01-15');
      expect(normalizeDateToISO('12/31/2024')).toBe('2024-12-31');
    });

    it('should return ISO format as-is', () => {
      expect(normalizeDateToISO('2025-01-15')).toBe('2025-01-15');
      expect(normalizeDateToISO('2024-12-31')).toBe('2024-12-31');
    });

    it('should handle invalid formats by returning as-is', () => {
      expect(normalizeDateToISO('invalid')).toBe('invalid');
      expect(normalizeDateToISO('2025/01/15')).toBe('2025/01/15');
    });

    it('should handle empty string', () => {
      expect(normalizeDateToISO('')).toBe('');
    });
  });
});


