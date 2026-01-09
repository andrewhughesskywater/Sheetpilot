import type { HotTableRef } from '@handsontable/react-wrapper';
import type { MutableRefObject } from 'react';
import { useEffect } from 'react';

export function useScrollbarFix(_dialogOpen: boolean, _hotTableRef: MutableRefObject<HotTableRef | null>) {
  useEffect(() => {
    // Placeholder for fixing scrollbar shifting when dialogs open/close
  }, [_dialogOpen]);
}
