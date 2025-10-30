import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import './styles/index.css'
import App, { Splash } from './App'
import { initializeLoggerFallback } from './utils/logger-fallback'
import { initializeAPIFallback } from './utils/api-fallback'

// Initialize logger fallback for development mode
initializeLoggerFallback();

// Initialize API fallbacks for development mode
initializeAPIFallback();

// Global error handlers for renderer process
window.addEventListener('error', (event) => {
  window.logger?.error('Uncaught error in renderer', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.stack || event.error?.message || String(event.error)
  });
});

window.addEventListener('unhandledrejection', (event) => {
  window.logger?.error('Unhandled promise rejection in renderer', {
    reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
    stack: event.reason instanceof Error ? event.reason.stack : undefined
  });
});

// Startup performance monitoring
const startupTime = Date.now();
window.addEventListener('load', () => {
  const loadTime = Date.now() - startupTime;
  window.logger?.info('Application startup completed', { 
    loadTimeMs: loadTime,
    performanceLevel: loadTime < 1000 ? 'fast' : loadTime < 3000 ? 'moderate' : 'slow'
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
        url: 'https://react.dev/link/react-devtools'
      });
    }
  });
});

// MUI theme is primarily overridden by M3 CSS tokens in m3-mui-overrides.css
// This minimal theme just ensures MUI doesn't break
const theme = createTheme({
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
})

const mountSplash = window.location.hash.includes('splash');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {mountSplash ? <Splash /> : <App />}
    </ThemeProvider>
  </StrictMode>,
)
