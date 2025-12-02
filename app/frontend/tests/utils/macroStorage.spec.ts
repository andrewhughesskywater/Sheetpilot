import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadMacros,
  saveMacros,
  isMacroEmpty,
  isMacroValid,
  type MacroRow
} from '../../src/utils/macroStorage';

describe('macroStorage', () => {
  let originalLocalStorage: Storage;
  let mockLocalStorage: Storage;

  beforeEach(() => {
    // Save original localStorage
    originalLocalStorage = globalThis.localStorage;
    
    // Create mock localStorage
    const storage: Record<string, string> = {};
    mockLocalStorage = {
      getItem: vi.fn((key: string) => storage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(storage).forEach(key => delete storage[key]);
      }),
      get length() {
        return Object.keys(storage).length;
      },
      key: vi.fn((index: number) => Object.keys(storage)[index] || null)
    } as Storage;
    
    (globalThis as { localStorage: Storage }).localStorage = mockLocalStorage;
  });

  afterEach(() => {
    (globalThis as { localStorage: Storage }).localStorage = originalLocalStorage;
  });

  describe('loadMacros', () => {
    it('should return empty macros when localStorage is empty', () => {
      const macros = loadMacros();
      
      expect(macros).toHaveLength(5);
      macros.forEach(macro => {
        expect(macro).toEqual({
          name: '',
          timeIn: '',
          timeOut: '',
          project: '',
          tool: null,
          chargeCode: null,
          taskDescription: ''
        });
      });
    });

    it('should load macros from localStorage', () => {
      const storedMacros: MacroRow[] = [
        {
          name: 'Macro 1',
          timeIn: '08:00',
          timeOut: '17:00',
          project: 'Project A',
          tool: 'Tool 1',
          chargeCode: 'CC1',
          taskDescription: 'Task 1'
        },
        createEmptyMacro(),
        createEmptyMacro(),
        createEmptyMacro(),
        createEmptyMacro()
      ];
      
      mockLocalStorage.setItem('sheetpilot-macros', JSON.stringify(storedMacros));
      
      const macros = loadMacros();
      expect(macros).toHaveLength(5);
      expect(macros[0]).toEqual(storedMacros[0]);
    });

    it('should handle invalid JSON gracefully', () => {
      mockLocalStorage.setItem('sheetpilot-macros', 'invalid json');
      
      const macros = loadMacros();
      expect(macros).toHaveLength(5);
      macros.forEach(macro => {
        expect(macro.name).toBe('');
      });
    });

    it('should handle wrong array length', () => {
      const shortArray = [createEmptyMacro(), createEmptyMacro()];
      mockLocalStorage.setItem('sheetpilot-macros', JSON.stringify(shortArray));
      
      const macros = loadMacros();
      expect(macros).toHaveLength(5);
    });

    it('should return empty macros when window is undefined', () => {
      const originalWindow = globalThis.window;
      delete (globalThis as { window?: typeof window }).window;
      
      const macros = loadMacros();
      expect(macros).toHaveLength(5);
      
      (globalThis as { window: typeof window }).window = originalWindow;
    });
  });

  describe('saveMacros', () => {
    it('should save macros to localStorage', () => {
      const macros: MacroRow[] = [
        {
          name: 'Macro 1',
          timeIn: '08:00',
          timeOut: '17:00',
          project: 'Project A',
          tool: 'Tool 1',
          chargeCode: 'CC1',
          taskDescription: 'Task 1'
        },
        createEmptyMacro(),
        createEmptyMacro(),
        createEmptyMacro(),
        createEmptyMacro()
      ];
      
      saveMacros(macros);
      
      const stored = mockLocalStorage.getItem('sheetpilot-macros');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(5);
      expect(parsed[0]).toEqual(macros[0]);
    });

    it('should handle localStorage errors gracefully', () => {
      const setItemSpy = vi.spyOn(mockLocalStorage, 'setItem').mockImplementation(() => {
        throw new Error('localStorage failed');
      });
      
      const macros = Array(5).fill(null).map(() => createEmptyMacro());
      expect(() => saveMacros(macros)).not.toThrow();
      
      setItemSpy.mockRestore();
    });

    it('should not save when window is undefined', () => {
      const originalWindow = globalThis.window;
      delete (globalThis as { window?: typeof window }).window;
      
      const macros = Array(5).fill(null).map(() => createEmptyMacro());
      expect(() => saveMacros(macros)).not.toThrow();
      
      (globalThis as { window: typeof window }).window = originalWindow;
    });
  });

  describe('isMacroEmpty', () => {
    it('should return true for empty macro', () => {
      const macro: MacroRow = createEmptyMacro();
      expect(isMacroEmpty(macro)).toBe(true);
    });

    it('should return false when macro has name', () => {
      const macro: MacroRow = {
        ...createEmptyMacro(),
        name: 'Test Macro'
      };
      expect(isMacroEmpty(macro)).toBe(false);
    });

    it('should return false when macro has project', () => {
      const macro: MacroRow = {
        ...createEmptyMacro(),
        project: 'Test Project'
      };
      expect(isMacroEmpty(macro)).toBe(false);
    });

    it('should return false when macro has taskDescription', () => {
      const macro: MacroRow = {
        ...createEmptyMacro(),
        taskDescription: 'Test Task'
      };
      expect(isMacroEmpty(macro)).toBe(false);
    });

    it('should return false when macro has timeIn', () => {
      const macro: MacroRow = {
        ...createEmptyMacro(),
        timeIn: '08:00'
      };
      expect(isMacroEmpty(macro)).toBe(false);
    });

    it('should return false when macro has timeOut', () => {
      const macro: MacroRow = {
        ...createEmptyMacro(),
        timeOut: '17:00'
      };
      expect(isMacroEmpty(macro)).toBe(false);
    });

    it('should return true when only tool is set (null is empty)', () => {
      const macro: MacroRow = {
        ...createEmptyMacro(),
        tool: null
      };
      expect(isMacroEmpty(macro)).toBe(true);
    });

    it('should return false when tool has value', () => {
      const macro: MacroRow = {
        ...createEmptyMacro(),
        tool: 'Tool 1'
      };
      expect(isMacroEmpty(macro)).toBe(false);
    });
  });

  describe('isMacroValid', () => {
    it('should return false for empty macro', () => {
      const macro: MacroRow = createEmptyMacro();
      expect(isMacroValid(macro)).toBe(false);
    });

    it('should return true when macro has project and taskDescription', () => {
      const macro: MacroRow = {
        ...createEmptyMacro(),
        project: 'Test Project',
        taskDescription: 'Test Task'
      };
      expect(isMacroValid(macro)).toBe(true);
    });

    it('should return false when only project is set', () => {
      const macro: MacroRow = {
        ...createEmptyMacro(),
        project: 'Test Project'
      };
      expect(isMacroValid(macro)).toBe(false);
    });

    it('should return false when only taskDescription is set', () => {
      const macro: MacroRow = {
        ...createEmptyMacro(),
        taskDescription: 'Test Task'
      };
      expect(isMacroValid(macro)).toBe(false);
    });

    it('should return true when macro has all fields', () => {
      const macro: MacroRow = {
        name: 'Macro 1',
        timeIn: '08:00',
        timeOut: '17:00',
        project: 'Test Project',
        tool: 'Tool 1',
        chargeCode: 'CC1',
        taskDescription: 'Test Task'
      };
      expect(isMacroValid(macro)).toBe(true);
    });
  });
});

function createEmptyMacro(): MacroRow {
  return {
    name: '',
    timeIn: '',
    timeOut: '',
    project: '',
    tool: null,
    chargeCode: null,
    taskDescription: ''
  };
}
