import './styles/index.css';

import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, type Theme, ThemeProvider } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import App, { Splash } from './App';
import { registerDefaultFrontendPlugins } from './plugins/register-default-plugins';
import { initializeLoggerFallback } from './utils/logger-fallback';
import { runOnce } from './utils/safe-init';
import { getCurrentEffectiveTheme, initializeTheme, subscribeToThemeChanges } from './utils/theme-manager';

// Initialize logger fallback for development mode (idempotent with guard)
runOnce(() => {
  initializeLoggerFallback();
}, 'renderer-init');

// Global error handlers for renderer process
window.addEventListener('error', (event) => {
  window.logger?.error('Uncaught error in renderer', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.stack || event.error?.message || String(event.error),
  });
});

window.addEventListener('unhandledrejection', (event) => {
  window.logger?.error('Unhandled promise rejection in renderer', {
    reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
    stack: event.reason instanceof Error ? event.reason.stack : undefined,
  });
});

// Startup performance monitoring
const startupTime = Date.now();
window.addEventListener('load', () => {
  const loadTime = Date.now() - startupTime;
  window.logger?.info('Application startup completed', {
    loadTimeMs: loadTime,
    performanceLevel: loadTime < 1000 ? 'fast' : loadTime < 3000 ? 'moderate' : 'slow',
  });
});

// Log when renderer is ready - optimized for startup performance
window.addEventListener('DOMContentLoaded', () => {
  // Defer non-critical initialization to prevent blocking startup
  requestAnimationFrame(() => {
    window.logger?.info('Renderer process loaded');

    // Development-only React DevTools recommendation
    if (import.meta.env.DEV) {
      window.logger?.info('React DevTools available', {
        message: 'For enhanced development experience, install React DevTools browser extension',
        url: 'https://react.dev/link/react-devtools',
      });
    }
  });
});

// Initialize theme system before rendering
initializeTheme();

// MUI theme is primarily overridden by M3 CSS tokens in m3-mui-overrides.css
// This theme ensures MUI respects dark mode and doesn't break
function createMuiTheme(mode: 'light' | 'dark'): Theme {
  return createTheme({
    palette: {
      mode,
    },
    typography: {
      h3: {
        fontWeight: 600,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
        },
      },
    },
  });
}

// Component wrapper to manage dynamic MUI theme
// eslint-disable-next-line react-refresh/only-export-components
function ThemedApp(): JSX.Element {
  const [muiTheme, setMuiTheme] = useState(() => createMuiTheme(getCurrentEffectiveTheme()));
  const [mountSplash, setMountSplash] = useState(() => window.location.hash.includes('splash'));
  const [pluginsReady, setPluginsReady] = useState(false);

  // Initialize frontend plugins before first render
  useEffect(() => {
    registerDefaultFrontendPlugins()
      .then(() => {
        setPluginsReady(true);
      })
      .catch((err) => {
        window.logger?.warn?.('Could not register frontend plugins', { error: err?.message || String(err) });
        // Allow rendering even if plugin registration fails (fallback to defaults)
        setPluginsReady(true);
      });
  }, []);

  useEffect(() => {
    // Update theme when it changes
    const unsubscribe = subscribeToThemeChanges(({ effectiveTheme }) => {
      setMuiTheme(createMuiTheme(effectiveTheme));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Listen for hash changes to transition from splash to app
    const handleHashChange = (): void => {
      setMountSplash(window.location.hash.includes('splash'));
    };

    window.addEventListener('hashchange', handleHashChange);
    // Also check on initial load
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {!pluginsReady ? null : mountSplash ? <Splash /> : <App />}
    </ThemeProvider>
  );
}

// StrictMode disabled for Handsontable compatibility
// Handsontable's editor state doesn't survive StrictMode's double-mount in dev
createRoot(document.getElementById('root')!).render(<ThemedApp />);
