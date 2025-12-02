import { describe, it, expect } from 'vitest';
import { autoCompleteEmailDomain } from '../../src/utils/emailAutoComplete';

describe('emailAutoComplete', () => {
  describe('autoCompleteEmailDomain', () => {
    it('should auto-complete when @ is typed with no domain', () => {
      expect(autoCompleteEmailDomain('user@')).toBe('user@skywatertechnology.com');
    });

    it('should auto-complete when partial domain matches', () => {
      expect(autoCompleteEmailDomain('user@s')).toBe('user@skywatertechnology.com');
      expect(autoCompleteEmailDomain('user@sk')).toBe('user@skywatertechnology.com');
      expect(autoCompleteEmailDomain('user@sky')).toBe('user@skywatertechnology.com');
      expect(autoCompleteEmailDomain('user@skywater')).toBe('user@skywatertechnology.com');
    });

    it('should not auto-complete when domain does not match', () => {
      expect(autoCompleteEmailDomain('user@other')).toBe('user@other');
      expect(autoCompleteEmailDomain('user@google')).toBe('user@google');
      expect(autoCompleteEmailDomain('user@example.com')).toBe('user@example.com');
    });

    it('should not auto-complete when domain is already complete', () => {
      expect(autoCompleteEmailDomain('user@skywatertechnology.com')).toBe('user@skywatertechnology.com');
    });

    it('should not auto-complete when no @ symbol', () => {
      expect(autoCompleteEmailDomain('user')).toBe('user');
      expect(autoCompleteEmailDomain('useremail')).toBe('useremail');
    });

    it('should handle multiple @ symbols by using last one', () => {
      expect(autoCompleteEmailDomain('user@old@')).toBe('user@old@skywatertechnology.com');
    });

    it('should handle empty string', () => {
      expect(autoCompleteEmailDomain('')).toBe('');
    });

    it('should handle just @ symbol', () => {
      expect(autoCompleteEmailDomain('@')).toBe('@skywatertechnology.com');
    });

    it('should handle case where domain part is longer than skywater domain', () => {
      expect(autoCompleteEmailDomain('user@skywatertechnologyx')).toBe('user@skywatertechnologyx');
    });
  });
});


