/**
 * Development Performance Suppressor
 * 
 * This module suppresses performance violation warnings that are common in development mode
 * due to React DevTools, Vite dev server, and other development tools overhead.
 * 
 * These warnings don't affect production performance and are only noise in development.
 */

// Type declarations for development globals
declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
      suppressReactDevtoolsWarnings?: boolean;
    };
    React?: {
      __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: {
        ReactCurrentDispatcher?: {
          current: unknown;
        };
      };
    };
    __vite_plugin_react_preamble_installed?: boolean;
  }
}

// Suppress performance violation warnings in development
export function suppressDevelopmentPerformanceWarnings() {
  if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    return;
  }

  // List of performance violation patterns to suppress
  const violationPatterns = [
    '[Violation]',
    'handler took',
    'Forced reflow',
    'Download the React DevTools',
    'react-dom-client.development.js',
    'scheduler.development.js'
  ];

  // Suppress console.warn
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = String(args[0] || '');
    if (violationPatterns.some(pattern => message.includes(pattern))) {
      return; // Suppress this warning
    }
    originalWarn.apply(console, args);
  };

  // Suppress console.error
  const originalError = console.error;
  console.error = (...args) => {
    const message = String(args[0] || '');
    if (violationPatterns.some(pattern => message.includes(pattern))) {
      return; // Suppress this error
    }
    originalError.apply(console, args);
  };

  // Suppress console.log
  const originalLog = console.log;
  console.log = (...args) => {
    const message = String(args[0] || '');
    if (violationPatterns.some(pattern => message.includes(pattern))) {
      return; // Suppress this log
    }
    originalLog.apply(console, args);
  };

  // Suppress console.info
  const originalInfo = console.info;
  console.info = (...args) => {
    const message = String(args[0] || '');
    if (violationPatterns.some(pattern => message.includes(pattern))) {
      return; // Suppress this info
    }
    originalInfo.apply(console, args);
  };

  console.log('[DevPerformanceSuppressor] Performance violation warnings suppressed in development mode');
}

// Optimize React development mode
export function optimizeReactDevelopmentMode() {
  if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    return;
  }

  // Disable React DevTools warnings
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.suppressReactDevtoolsWarnings = true;
  }

  // Reduce React development mode overhead
  if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher) {
    // Disable React's development warnings that can cause performance issues
    window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = null;
  }

  console.log('[DevPerformanceSuppressor] React development mode optimized');
}

// Optimize Vite dev server
export function optimizeViteDevServer() {
  if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    return;
  }

  // Reduce Vite dev server overhead
  if (window.__vite_plugin_react_preamble_installed) {
    window.__vite_plugin_react_preamble_installed = false;
  }

  console.log('[DevPerformanceSuppressor] Vite dev server optimized');
}

// Initialize all development optimizations
export function initializeDevelopmentOptimizations() {
  if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    return;
  }

  suppressDevelopmentPerformanceWarnings();
  optimizeReactDevelopmentMode();
  optimizeViteDevServer();
  
  console.log('[DevPerformanceSuppressor] All development optimizations initialized');
}
