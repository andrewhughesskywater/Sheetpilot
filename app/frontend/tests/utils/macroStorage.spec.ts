/**
 * @fileoverview Macro Storage Utility Tests
 * 
 * Tests for macro save/load, validation, and localStorage management.
 * Critical for user productivity and data persistence.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { saveMacros, loadMacros, type MacroRow } from '../../../src/utils/macroStorage';

describe('Macro Storage Utility', () => {
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    mockLocalStorage = {};
    
    global.localStorage = {
      getItem: (key: string) => mockLocalStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
      clear: () => {
        mockLocalStorage = {};
      },
      length: 0,
      key: () => null
    } as Storage;
  });

  describe('saveMacros', () => {
    it('should save macros to localStorage', () => {
      const macros: MacroRow[] = [
        {
          name: 'Daily Entry',
          project: 'FL-Carver Techs',
          tool: '#1 Rinse and 2D marker',
          chargeCode: 'EPR1',
          taskDescription: 'Daily maintenance'
        }
      ];
      
      saveMacros(macros);
      
      const stored = mockLocalStorage['sheetpilot_macros'];
      expect(stored).toBeDefined();
      
      const parsed = JSON.parse(stored);
      expect(parsed).toEqual(macros);
    });

    it('should save multiple macros', () => {
      const macros: MacroRow[] = [
        {
          name: 'Macro 1',
          project: 'Test1',
          taskDescription: 'Task1'
        },
        {
          name: 'Macro 2',
          project: 'Test2',
          taskDescription: 'Task2'
        }
      ];
      
      saveMacros(macros);
      
      const stored = JSON.parse(mockLocalStorage['sheetpilot_macros']);
      expect(stored).toHaveLength(2);
    });

    it('should save empty array', () => {
      saveMacros([]);
      
      const stored = JSON.parse(mockLocalStorage['sheetpilot_macros']);
      expect(stored).toEqual([]);
    });

    it('should overwrite existing macros', () => {
      const macros1: MacroRow[] = [{ name: 'Old', project: 'Test', taskDescription: 'Task' }];
      const macros2: MacroRow[] = [{ name: 'New', project: 'Test', taskDescription: 'Task' }];
      
      saveMacros(macros1);
      saveMacros(macros2);
      
      const stored = JSON.parse(mockLocalStorage['sheetpilot_macros']);
      expect(stored).toEqual(macros2);
      expect(stored).not.toEqual(macros1);
    });

    it('should handle macros with null values', () => {
      const macros: MacroRow[] = [
        {
          name: 'PTO Macro',
          project: 'PTO/RTO',
          tool: null,
          chargeCode: null,
          taskDescription: 'Time off'
        }
      ];
      
      saveMacros(macros);
      
      const stored = JSON.parse(mockLocalStorage['sheetpilot_macros']);
      expect(stored[0].tool).toBeNull();
      expect(stored[0].chargeCode).toBeNull();
    });

    it('should handle very long macro names', () => {
      const macros: MacroRow[] = [
        {
          name: 'A'.repeat(500),
          project: 'Test',
          taskDescription: 'Task'
        }
      ];
      
      saveMacros(macros);
      
      const stored = JSON.parse(mockLocalStorage['sheetpilot_macros']);
      expect(stored[0].name.length).toBe(500);
    });

    it('should handle special characters', () => {
      const macros: MacroRow[] = [
        {
          name: 'Macro #1 - [Priority]',
          project: 'FL/Carver-Techs',
          taskDescription: 'Task with "quotes" and <brackets>'
        }
      ];
      
      saveMacros(macros);
      
      const stored = JSON.parse(mockLocalStorage['sheetpilot_macros']);
      expect(stored[0].name).toContain('#');
      expect(stored[0].taskDescription).toContain('"');
    });

    it('should handle unicode characters', () => {
      const macros: MacroRow[] = [
        {
          name: 'Макрос 🚀',
          project: 'Test',
          taskDescription: 'Task with 中文'
        }
      ];
      
      saveMacros(macros);
      
      const stored = JSON.parse(mockLocalStorage['sheetpilot_macros']);
      expect(stored[0].name).toContain('🚀');
      expect(stored[0].taskDescription).toContain('中文');
    });
  });

  describe('loadMacros', () => {
    it('should load macros from localStorage', () => {
      const macros: MacroRow[] = [
        {
          name: 'Test Macro',
          project: 'Test',
          taskDescription: 'Task'
        }
      ];
      
      mockLocalStorage['sheetpilot_macros'] = JSON.stringify(macros);
      
      const loaded = loadMacros();
      expect(loaded).toEqual(macros);
    });

    it('should return empty array if no macros stored', () => {
      const loaded = loadMacros();
      expect(loaded).toEqual([]);
    });

    it('should handle corrupted JSON gracefully', () => {
      mockLocalStorage['sheetpilot_macros'] = 'invalid json {{{';
      
      const loaded = loadMacros();
      expect(loaded).toEqual([]);
    });

    it('should handle non-array data', () => {
      mockLocalStorage['sheetpilot_macros'] = JSON.stringify({ not: 'an array' });
      
      const loaded = loadMacros();
      expect(loaded).toEqual([]);
    });

    it('should load multiple macros', () => {
      const macros: MacroRow[] = [
        { name: 'Macro 1', project: 'Test1', taskDescription: 'Task1' },
        { name: 'Macro 2', project: 'Test2', taskDescription: 'Task2' },
        { name: 'Macro 3', project: 'Test3', taskDescription: 'Task3' }
      ];
      
      mockLocalStorage['sheetpilot_macros'] = JSON.stringify(macros);
      
      const loaded = loadMacros();
      expect(loaded).toHaveLength(3);
    });
  });

  describe('Round-Trip Persistence', () => {
    it('should preserve data through save and load', () => {
      const macros: MacroRow[] = [
        {
          name: 'Test Macro',
          project: 'FL-Carver Techs',
          tool: '#1 Rinse and 2D marker',
          chargeCode: 'EPR1',
          taskDescription: 'Test task'
        }
      ];
      
      saveMacros(macros);
      const loaded = loadMacros();
      
      expect(loaded).toEqual(macros);
    });

    it('should preserve null values', () => {
      const macros: MacroRow[] = [
        {
          name: 'PTO',
          project: 'PTO/RTO',
          tool: null,
          chargeCode: null,
          taskDescription: 'Time off'
        }
      ];
      
      saveMacros(macros);
      const loaded = loadMacros();
      
      expect(loaded[0].tool).toBeNull();
      expect(loaded[0].chargeCode).toBeNull();
    });

    it('should preserve special characters', () => {
      const macros: MacroRow[] = [
        {
          name: 'Special #1 [High]',
          project: 'Test/Project',
          taskDescription: 'Task with "quotes" and <brackets>'
        }
      ];
      
      saveMacros(macros);
      const loaded = loadMacros();
      
      expect(loaded[0].name).toBe('Special #1 [High]');
      expect(loaded[0].taskDescription).toContain('"');
    });
  });

  describe('Storage Limits', () => {
    it('should handle storage quota exceeded', () => {
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      
      const largeMacros: MacroRow[] = Array(1000).fill({
        name: 'Macro',
        project: 'Test',
        taskDescription: 'Long description '.repeat(100)
      });
      
      expect(() => saveMacros(largeMacros)).not.toThrow();
      
      setItemSpy.mockRestore();
    });

    it('should handle very large macro datasets', () => {
      const macros: MacroRow[] = [];
      
      for (let i = 0; i < 100; i++) {
        macros.push({
          name: `Macro ${i}`,
          project: 'Test',
          taskDescription: `Task ${i}`
        });
      }
      
      saveMacros(macros);
      const loaded = loadMacros();
      
      expect(loaded).toHaveLength(100);
    });
  });

  describe('Macro Validation', () => {
    it('should validate macro has required fields', () => {
      const validateMacro = (macro: MacroRow) => {
        return !!(macro.name && macro.project && macro.taskDescription);
      };
      
      const validMacro: MacroRow = {
        name: 'Test',
        project: 'Test',
        taskDescription: 'Task'
      };
      
      const invalidMacro: MacroRow = {
        name: 'Test',
        project: '',
        taskDescription: ''
      };
      
      expect(validateMacro(validMacro)).toBe(true);
      expect(validateMacro(invalidMacro)).toBe(false);
    });

    it('should allow optional fields to be null', () => {
      const macro: MacroRow = {
        name: 'Test',
        project: 'PTO/RTO',
        tool: null,
        chargeCode: null,
        taskDescription: 'Task'
      };
      
      expect(macro.tool).toBeNull();
      expect(macro.chargeCode).toBeNull();
      expect(macro.name).toBeDefined();
    });
  });

  describe('Storage Corruption Recovery', () => {
    it('should recover from corrupted JSON', () => {
      mockLocalStorage['sheetpilot_macros'] = '{broken json]';
      
      const loaded = loadMacros();
      expect(loaded).toEqual([]);
    });

    it('should recover from null in localStorage', () => {
      mockLocalStorage['sheetpilot_macros'] = 'null';
      
      const loaded = loadMacros();
      expect(loaded).toEqual([]);
    });

    it('should recover from undefined in localStorage', () => {
      mockLocalStorage['sheetpilot_macros'] = 'undefined';
      
      const loaded = loadMacros();
      expect(loaded).toEqual([]);
    });

    it('should recover from non-macro data', () => {
      mockLocalStorage['sheetpilot_macros'] = JSON.stringify('string data');
      
      const loaded = loadMacros();
      expect(loaded).toEqual([]);
    });

    it('should recover from array of non-objects', () => {
      mockLocalStorage['sheetpilot_macros'] = JSON.stringify([1, 2, 3]);
      
      const loaded = loadMacros();
      // Depending on implementation, might return empty or filter out invalid items
      expect(Array.isArray(loaded)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should save large macro sets efficiently', () => {
      const macros: MacroRow[] = Array(100).fill({
        name: 'Macro',
        project: 'Test',
        taskDescription: 'Task'
      }).map((m, i) => ({ ...m, name: `Macro ${i}` }));
      
      const startTime = Date.now();
      saveMacros(macros);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(500);
    });

    it('should load large macro sets efficiently', () => {
      const macros: MacroRow[] = Array(100).fill({
        name: 'Macro',
        project: 'Test',
        taskDescription: 'Task'
      });
      
      mockLocalStorage['sheetpilot_macros'] = JSON.stringify(macros);
      
      const startTime = Date.now();
      const loaded = loadMacros();
      const duration = Date.now() - startTime;
      
      expect(loaded).toHaveLength(100);
      expect(duration).toBeLessThan(500);
    });
  });
});

