import { ipcRenderer } from 'electron';

interface CSPViolation {
  directive: string;
  blockedURI: string;
  violatedDirective: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export const cspBridge = {
  reportViolation: (violation: CSPViolation): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('csp:report-violation', violation),
};
