import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import './index.css'
import App from './App.tsx'

// Global error handlers for renderer process
window.addEventListener('error', (event) => {
  window.logger.error('Uncaught error in renderer', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.stack || event.error?.message || String(event.error)
  });
});

window.addEventListener('unhandledrejection', (event) => {
  window.logger.error('Unhandled promise rejection in renderer', {
    reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
    stack: event.reason instanceof Error ? event.reason.stack : undefined
  });
});

// Log when renderer is ready
window.addEventListener('DOMContentLoaded', () => {
  window.logger.info('Renderer process loaded');
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
