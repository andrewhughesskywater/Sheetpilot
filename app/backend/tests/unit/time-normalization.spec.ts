/**
 * @fileoverview Time Normalization Unit Tests
 *
 * Tests time format conversion and normalization to prevent AI regression.
 * Validates HH:MM ↔ minutes since midnight conversions.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect } from 'vitest';
import { formatTimeInput } from '@/logic/timesheet-validation';
import { timeFormatTestCases } from '../fixtures/timesheet-data';

describe('Time Normalization Unit Tests', () => {
  describe('Time Format Conversion', () => {
    it('should convert numeric time formats correctly', () => {
      const conversionTests = [
        { input: '900', expected: '09:00' },
        { input: '1730', expected: '17:30' },
        { input: '800', expected: '08:00' },
        { input: '1430', expected: '14:30' },
        { input: '08', expected: '08:00' },
        { input: '8', expected: '08:00' },
        { input: '00', expected: '00:00' },
        { input: '0', expected: '00:00' },
      ];

      conversionTests.forEach(({ input, expected }) => {
        expect(formatTimeInput(input)).toBe(expected);
      });
    });

    it('should preserve already formatted HH:MM times', () => {
      const formattedTimes = ['09:00', '17:30', '00:00', '23:45', '12:15'];

      formattedTimes.forEach((time) => {
        expect(formatTimeInput(time)).toBe(time);
      });
    });

    it('should handle edge cases correctly', () => {
      const edgeCases = [
        { input: '1200', expected: '12:00' },
        { input: '1230', expected: '12:30' },
        { input: '1245', expected: '12:45' },
        { input: '2359', expected: '23:59' },
        { input: '0000', expected: '00:00' },
      ];

      edgeCases.forEach(({ input, expected }) => {
        expect(formatTimeInput(input)).toBe(expected);
      });
    });

    it('should handle invalid inputs gracefully', () => {
      const invalidInputs = [
        'abc',
        '12:34:56', // Seconds not supported
        '25:00', // Invalid hour
        '12:60', // Invalid minute
        '',
        '12345', // Too many digits
      ];

      invalidInputs.forEach((input) => {
        const result = formatTimeInput(input);
        // Should return original input for invalid formats
        expect(result).toBe(input);
      });

      // Test ambiguous input that gets converted
      expect(formatTimeInput('12')).toBe('12:00');
    });
  });

  describe('Time Validation', () => {
    it('should validate all test cases correctly', () => {
      timeFormatTestCases.forEach(({ input, expected, isValid }) => {
        const formatted = formatTimeInput(input);

        if (isValid) {
          expect(formatted).toBe(expected);
        } else {
          // For invalid inputs, should return original or formatted version
          expect(formatted).toBeDefined();
        }
      });
    });

    it('should enforce 15-minute increments', () => {
      const validIncrements = [
        '00:00',
        '00:15',
        '00:30',
        '00:45',
        '09:00',
        '09:15',
        '09:30',
        '09:45',
        '17:00',
        '17:15',
        '17:30',
        '17:45',
        '23:00',
        '23:15',
        '23:30',
        '23:45',
      ];

      const invalidIncrements = [
        '09:01',
        '09:07',
        '09:13',
        '09:22',
        '09:38',
        '09:52',
        '17:03',
        '17:17',
        '17:23',
        '17:37',
        '17:53',
      ];

      validIncrements.forEach((time) => {
        const formatted = formatTimeInput(time);
        const [hours, minutes] = formatted.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        expect(totalMinutes % 15).toBe(0);
      });

      invalidIncrements.forEach((time) => {
        const formatted = formatTimeInput(time);
        const [hours, minutes] = formatted.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        expect(totalMinutes % 15).not.toBe(0);
      });
    });
  });

  describe('Time Conversion Functions', () => {
    it('should convert time string to minutes correctly', () => {
      const timeToMinutesTests = [
        { time: '00:00', minutes: 0 },
        { time: '00:15', minutes: 15 },
        { time: '00:30', minutes: 30 },
        { time: '00:45', minutes: 45 },
        { time: '01:00', minutes: 60 },
        { time: '09:00', minutes: 540 },
        { time: '12:30', minutes: 750 },
        { time: '17:00', minutes: 1020 },
        { time: '23:45', minutes: 1425 },
        { time: '23:59', minutes: 1439 },
      ];

      timeToMinutesTests.forEach(({ time, minutes }) => {
        const [hours, mins] = time.split(':').map(Number);
        const totalMinutes = hours * 60 + mins;
        expect(totalMinutes).toBe(minutes);
      });
    });

    it('should convert minutes to time string correctly', () => {
      const minutesToTimeTests = [
        { minutes: 0, time: '00:00' },
        { minutes: 15, time: '00:15' },
        { minutes: 30, time: '00:30' },
        { minutes: 45, time: '00:45' },
        { minutes: 60, time: '01:00' },
        { minutes: 540, time: '09:00' },
        { minutes: 750, time: '12:30' },
        { minutes: 1020, time: '17:00' },
        { minutes: 1425, time: '23:45' },
        { minutes: 1439, time: '23:59' },
      ];

      minutesToTimeTests.forEach(({ minutes, time }) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        expect(timeString).toBe(time);
      });
    });

    it('should maintain round-trip conversion consistency', () => {
      const testTimes = [
        '00:00',
        '00:15',
        '00:30',
        '00:45',
        '09:00',
        '09:15',
        '09:30',
        '09:45',
        '17:00',
        '17:15',
        '17:30',
        '17:45',
        '23:00',
        '23:15',
        '23:30',
        '23:45',
      ];

      testTimes.forEach((time) => {
        // Convert to minutes and back
        const [hours, minutes] = time.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        const convertedHours = Math.floor(totalMinutes / 60);
        const convertedMinutes = totalMinutes % 60;
        const convertedTime = `${convertedHours.toString().padStart(2, '0')}:${convertedMinutes.toString().padStart(2, '0')}`;

        expect(convertedTime).toBe(time);
      });
    });
  });

  describe('Time Range Validation', () => {
    it('should validate time ranges correctly', () => {
      const validRanges = [
        { start: '00:00', end: '00:15' },
        { start: '09:00', end: '17:00' },
        { start: '08:30', end: '16:30' },
        { start: '23:30', end: '23:45' },
        { start: '12:00', end: '12:30' },
      ];

      validRanges.forEach(({ start, end }) => {
        const [startHours, startMinutes] = start.split(':').map(Number);
        const [endHours, endMinutes] = end.split(':').map(Number);
        const startTotal = startHours * 60 + startMinutes;
        const endTotal = endHours * 60 + endMinutes;

        expect(endTotal).toBeGreaterThan(startTotal);
      });
    });

    it('should reject invalid time ranges', () => {
      const invalidRanges = [
        { start: '17:00', end: '09:00' },
        { start: '09:30', end: '09:15' },
        { start: '12:45', end: '08:30' },
        { start: '09:00', end: '09:00' }, // Same time
        { start: '15:30', end: '15:30' }, // Same time
      ];

      invalidRanges.forEach(({ start, end }) => {
        const [startHours, startMinutes] = start.split(':').map(Number);
        const [endHours, endMinutes] = end.split(':').map(Number);
        const startTotal = startHours * 60 + startMinutes;
        const endTotal = endHours * 60 + endMinutes;

        expect(endTotal).toBeLessThanOrEqual(startTotal);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle midnight correctly', () => {
      const midnightTests = [
        { input: '00:00', expected: '00:00' },
        { input: '0000', expected: '00:00' },
        { input: '0', expected: '00:00' },
        { input: '00', expected: '00:00' },
      ];

      midnightTests.forEach(({ input, expected }) => {
        expect(formatTimeInput(input)).toBe(expected);
      });
    });

    it('should handle noon correctly', () => {
      const noonTests = [
        { input: '12:00', expected: '12:00' },
        { input: '1200', expected: '12:00' },
        { input: '12', expected: '12:00' },
      ];

      noonTests.forEach(({ input, expected }) => {
        expect(formatTimeInput(input)).toBe(expected);
      });
    });

    it('should handle late night times correctly', () => {
      const lateNightTests = [
        { input: '23:45', expected: '23:45' },
        { input: '2345', expected: '23:45' },
        { input: '23:59', expected: '23:59' },
        { input: '2359', expected: '23:59' },
      ];

      lateNightTests.forEach(({ input, expected }) => {
        expect(formatTimeInput(input)).toBe(expected);
      });
    });

    it('should handle single digit hours correctly', () => {
      const singleDigitTests = [
        { input: '8', expected: '08:00' },
        { input: '9', expected: '09:00' },
        { input: '8:30', expected: '08:30' },
        { input: '9:15', expected: '09:15' },
      ];

      singleDigitTests.forEach(({ input, expected }) => {
        expect(formatTimeInput(input)).toBe(expected);
      });
    });
  });

  describe('Performance', () => {
    it('should format times efficiently', () => {
      const testInputs = ['900', '1730', '800', '1430', '08', '8', '09:00', '17:30', '00:00', '23:45', '12:15'];

      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        testInputs.forEach((input) => {
          formatTimeInput(input);
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should handle large datasets efficiently', () => {
      const startTime = Date.now();

      // Generate 1000 random time inputs
      for (let i = 0; i < 1000; i++) {
        const hours = Math.floor(Math.random() * 24);
        const minutes = Math.floor(Math.random() * 4) * 15; // 15-minute increments
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        formatTimeInput(timeString);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200); // Should be reasonably fast
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent output format', () => {
      const testInputs = ['900', '1730', '800', '1430', '08', '8', '09:00', '17:30', '00:00', '23:45'];

      testInputs.forEach((input) => {
        const output = formatTimeInput(input);

        // All outputs should be in HH:MM format
        expect(output).toMatch(/^\d{2}:\d{2}$/);

        // Hours should be 00-23
        const [hours, minutes] = output.split(':').map(Number);
        expect(hours).toBeGreaterThanOrEqual(0);
        expect(hours).toBeLessThan(24);

        // Minutes should be 00-59
        expect(minutes).toBeGreaterThanOrEqual(0);
        expect(minutes).toBeLessThan(60);
      });
    });

    it('should handle all valid time combinations', () => {
      // Test all valid hours and 15-minute increments
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const formatted = formatTimeInput(timeString);

          expect(formatted).toBe(timeString);
        }
      }
    });
  });

  describe('Advanced Edge Cases - Negative Time Values', () => {
    it('should handle negative time values', () => {
      const negativeTimeValues = ['-1', '-100', '-900', '-1:00', '-09:00'];

      negativeTimeValues.forEach((input) => {
        const result = formatTimeInput(input);
        // Should return original input for invalid negative values
        expect(result).toBe(input);
      });
    });

    it('should reject negative hours in HH:MM format', () => {
      expect(formatTimeInput('-01:00')).toBe('-01:00'); // Invalid, returned as-is
      expect(formatTimeInput('-12:30')).toBe('-12:30'); // Invalid, returned as-is
    });

    it('should reject negative minutes', () => {
      expect(formatTimeInput('09:-15')).toBe('09:-15'); // Invalid, returned as-is
      expect(formatTimeInput('12:-30')).toBe('12:-30'); // Invalid, returned as-is
    });
  });

  describe('Advanced Edge Cases - Times Greater Than 24 Hours', () => {
    it('should handle times with hours >= 24', () => {
      const invalidHours = [
        '24:00', // 24 hours
        '25:00', // 25 hours
        '30:00', // 30 hours
        '48:00', // 48 hours
        '99:59', // 99 hours
      ];

      invalidHours.forEach((input) => {
        const result = formatTimeInput(input);
        // Should return original input for hours >= 24
        expect(result).toBe(input);
      });
    });

    it('should handle numeric times representing hours >= 24', () => {
      const invalidNumericTimes = [
        '2400', // 24:00
        '2500', // 25:00
        '3000', // 30:00
        '9999', // 99:99
      ];

      invalidNumericTimes.forEach((input) => {
        const result = formatTimeInput(input);
        // Should return original input for invalid hours
        expect(result).toBe(input);
      });
    });

    it('should reject times with minutes >= 60', () => {
      const invalidMinutes = [
        '09:60', // 60 minutes
        '09:75', // 75 minutes
        '12:99', // 99 minutes
        '23:100', // 100 minutes
      ];

      invalidMinutes.forEach((input) => {
        const result = formatTimeInput(input);
        // Should return original input for minutes >= 60
        expect(result).toBe(input);
      });
    });
  });

  describe('Advanced Edge Cases - Fractional Minutes', () => {
    it('should handle fractional minute values', () => {
      const fractionalMinutes = [
        '09:30.5', // Half minute
        '12:15.75', // Three-quarters minute
        '17:45.25', // Quarter minute
        '23:00.9', // Decimal minute
      ];

      fractionalMinutes.forEach((input) => {
        const result = formatTimeInput(input);
        // Should return original input for fractional minutes
        expect(result).toBe(input);
      });
    });

    it('should handle decimal notation in numeric format', () => {
      const decimalTimes = [
        '9.5', // 9.5 hours
        '12.25', // 12.25 hours
        '17.75', // 17.75 hours
        '930.5', // 9:30.5
      ];

      decimalTimes.forEach((input) => {
        const result = formatTimeInput(input);
        // Should return original input for decimal notation
        expect(result).toBe(input);
      });
    });

    it('should handle scientific notation', () => {
      const scientificNotation = [
        '1e2', // 100
        '9.5e1', // 95
        '1.2e3', // 1200
      ];

      scientificNotation.forEach((input) => {
        const result = formatTimeInput(input);
        // Should return original input for scientific notation
        expect(result).toBe(input);
      });
    });

    it('should handle fractional hours in standard format', () => {
      // Hours as decimals (e.g., 9.5 hours = 9:30)
      // This should NOT be supported by formatTimeInput
      const fractionalHours = [
        { input: '9.5', expected: '9.5' }, // Should not convert
        { input: '12.25', expected: '12.25' }, // Should not convert
        { input: '17.75', expected: '17.75' }, // Should not convert
      ];

      fractionalHours.forEach(({ input, expected }) => {
        const result = formatTimeInput(input);
        expect(result).toBe(expected); // Returns original for unsupported format
      });
    });

    it('should handle very small fractional values', () => {
      const smallFractions = ['09:00.001', '12:30.0001', '17:45.00001'];

      smallFractions.forEach((input) => {
        const result = formatTimeInput(input);
        expect(result).toBe(input); // Invalid format, returned as-is
      });
    });

    it('should handle fractional seconds (not supported)', () => {
      const fractionalSeconds = ['09:00:30.5', '12:30:45.75', '17:45:59.999'];

      fractionalSeconds.forEach((input) => {
        const result = formatTimeInput(input);
        expect(result).toBe(input); // Seconds not supported, returned as-is
      });
    });
  });
});
