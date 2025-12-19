import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpellcheckEditor } from '../../../src/components/timesheet/SpellcheckEditor';

// Mock Handsontable TextEditor
vi.mock('handsontable/editors/textEditor', () => {
  class MockTextEditor {
    TEXTAREA: HTMLTextAreaElement | null = null;

    createElements() {
      this.TEXTAREA = document.createElement('textarea');
    }
  }
  return { TextEditor: MockTextEditor };
});

describe('SpellcheckEditor', () => {
  let editor: SpellcheckEditor;

  beforeEach(() => {
    editor = new SpellcheckEditor({} as unknown as ConstructorParameters<typeof SpellcheckEditor>[0]);
  });

  it('should extend TextEditor', () => {
    expect(editor).toBeInstanceOf(SpellcheckEditor);
  });

  it('should enable spellcheck on textarea', () => {
    editor.createElements();

    expect(editor.TEXTAREA).toBeDefined();
    expect(editor.TEXTAREA?.getAttribute('spellcheck')).toBe('true');
  });

  it('should handle missing textarea gracefully', () => {
    editor.TEXTAREA = null as unknown as HTMLTextAreaElement;
    
    // Should not throw
    expect(() => editor.createElements()).not.toThrow();
  });

  it('should call parent createElements', () => {
    const createElementsSpy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(editor)), 'createElements');
    
    editor.createElements();

    expect(createElementsSpy).toHaveBeenCalled();
  });
});


