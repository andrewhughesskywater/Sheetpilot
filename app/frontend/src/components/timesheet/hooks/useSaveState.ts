import type { HotTableRef } from '@handsontable/react-wrapper';
import type { MutableRefObject } from 'react';
import { useCallback, useRef, useState } from 'react';

export type SaveState = 'neutral' | 'saving' | 'saved';

export function useSaveState<T>(
  _timesheetDraftData: T[],
  _setTimesheetDraftData: (rows: T[]) => void,
  _onChange: ((rows: T[]) => void) | undefined,
  _hotTableRef: MutableRefObject<HotTableRef | null>
) {
  const [saveButtonState, setSaveButtonState] = useState<SaveState>('neutral');
  const unsavedRowsRef = useRef<Set<number>>(new Set());
  const pendingSaveRef = useRef<Map<number, unknown>>(new Map());
  const saveTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const inFlightSavesRef = useRef<Map<number, AbortController>>(new Map());
  const saveStartTimeRef = useRef<Map<number, number>>(new Map());

  const updateSaveButtonState = (state: SaveState) => setSaveButtonState(state);

  const handleManualSave = useCallback(async () => {
    setSaveButtonState('saving');
    await new Promise((r) => setTimeout(r, 250));
    setSaveButtonState('saved');
    setTimeout(() => setSaveButtonState('neutral'), 1000);
  }, []);

  const saveAndReloadRow = async (_rowIndex: number) => {
    // Placeholder: integrate row save
  };

  return {
    saveButtonState,
    setSaveButtonState,
    unsavedRowsRef,
    pendingSaveRef,
    saveTimersRef,
    inFlightSavesRef,
    saveStartTimeRef,
    updateSaveButtonState,
    handleManualSave,
    saveAndReloadRow,
  } as const;
}
