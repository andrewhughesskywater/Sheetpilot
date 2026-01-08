import { useState } from 'react';
import type { MacroRow } from '../../../utils/macroStorage';
import { loadMacros } from '../../../utils/macroStorage';

export function useMacroSystem() {
  // Use lazy initializer to load macros on first render without causing effect cascades
  const [macros, setMacros] = useState<MacroRow[]>(() => {
    try {
      return loadMacros();
    } catch {
      return [];
    }
  });
  const [showMacroDialog, setShowMacroDialog] = useState(false);

  const applyMacro = (_index: number) => {
    // Integrate real macro apply in future
  };

  const duplicateSelectedRow = () => {
    // Implement duplication logic if needed later
  };

  const handleKeyDownMacros = (_e: KeyboardEvent) => {
    // Shortcut handling can be added here
  };

  return {
    macros,
    setMacros,
    showMacroDialog,
    setShowMacroDialog,
    applyMacro,
    duplicateSelectedRow,
    handleKeyDownMacros,
  } as const;
}
