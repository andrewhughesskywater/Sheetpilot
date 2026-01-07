import { useEffect } from 'react';

export function useKeyboardShortcuts(
  applyMacro: (index: number) => void,
  duplicateSelectedRow: () => void
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        // Ctrl+1..5 apply macros
        const num = Number(e.key);
        if (Number.isInteger(num) && num >= 1 && num <= 5) {
          applyMacro(num - 1);
        }
      }
      // Example: Ctrl+D to duplicate (optional placeholder)
      if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        duplicateSelectedRow();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [applyMacro, duplicateSelectedRow]);
}
