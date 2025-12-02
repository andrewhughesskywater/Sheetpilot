/// <reference types="vite/client" />

/**
 * Safe initialization guard to prevent duplicate module-level initialization
 * in development mode (HMR, StrictMode, etc.)
 */

declare global {
  interface Window {
    __appInitialized?: boolean;
  }
}

/**
 * Ensures initialization code runs only once, even with React StrictMode
 * or Hot Module Replacement (HMR) in development.
 * 
 * @param initFn - The initialization function to run once
 * @param debugLabel - Label for diagnostic logging
 */
export function runOnce(initFn: () => void, debugLabel: string): void {
  if (typeof window === 'undefined') {
    return; // Skip in SSR or non-browser environments
  }

  if (!window.__appInitialized) {
    window.__appInitialized = true;
    
    if (import.meta.env.DEV) {
      console.debug(`[app] init:1 ts:${globalThis.performance.now().toFixed(2)}ms label:${debugLabel}`);
    }
    
    initFn();
  } else {
    if (import.meta.env.DEV) {
      console.debug(`[app] init:skipped ts:${globalThis.performance.now().toFixed(2)}ms label:${debugLabel} (already initialized)`);
    }
  }
}

/**
 * Check if the app has been initialized
 */
export function isInitialized(): boolean {
  return typeof window !== 'undefined' && window.__appInitialized === true;
}

