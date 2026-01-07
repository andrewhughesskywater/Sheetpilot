import { useEffect, useState } from 'react';
import type { MacroRow } from '../../../utils/macroStorage';
import { loadMacros } from '../../../utils/macroStorage';

export function useMacroSystem() {
  const [macros, setMacros] = useState<MacroRow[]>([]);
  const [showMacroDialog, setShowMacroDialog] = useState(false);

  useEffect(() => {
    try {
      const loaded = loadMacros();
      setMacros(loaded);
    } catch {
      setMacros([]);
    }
  }, []);

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
