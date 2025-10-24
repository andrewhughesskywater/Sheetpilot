import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './', // Use relative paths for assets in production builds
  resolve: {
    alias: {
      '/fonts': path.resolve(__dirname, 'assets/fonts'),
    },
  },
  assetsInclude: ['**/*.ttf', '**/*.woff', '**/*.woff2'],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Bundle React with emotion to avoid initialization issues
          'react-vendor': ['react', 'react-dom', '@emotion/react', '@emotion/styled'],
          'mui-core': ['@mui/material', '@mui/icons-material'],
          'handsontable': ['handsontable', '@handsontable/react-wrapper'],
        },
      },
    },
    chunkSizeWarningLimit: 800, // Increase to accommodate larger react-vendor chunk
    target: 'esnext', // Use modern ES features
    minify: false, // Disable minification for debugging
  },
  // Development server configuration
  server: {
    headers: {
      // More permissive CSP for development (allows hot reloading)
      'Content-Security-Policy': mode === 'development' 
        ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' ws: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:;"
        : "default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:;"
    }
  }
}))
