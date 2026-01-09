import { useEffect } from 'react';

export function useKeyboardShortcuts(applyMacro: (index: number) => void, duplicateSelectedRow: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const hasShortcutModifier = e.ctrlKey || e.metaKey;

      if (hasShortcutModifier) {
        // Ctrl/Cmd + 1..5 apply macros
        const num = Number(e.key);
        if (Number.isInteger(num) && num >= 1 && num <= 5) {
          applyMacro(num - 1);
        }
      }

      // Ctrl/Cmd + D duplicates the selected row
      if (hasShortcutModifier && (e.key === 'd' || e.key === 'D')) {
        duplicateSelectedRow();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [applyMacro, duplicateSelectedRow]);
}
