import { useEffect } from 'react';
import type { MutableRefObject } from 'react';

export function useScrollbarFix(
  _dialogOpen: boolean,
  _hotTableRef: MutableRefObject<any>
) {
  useEffect(() => {
    // Placeholder for fixing scrollbar shifting when dialogs open/close
  }, [_dialogOpen]);
}
