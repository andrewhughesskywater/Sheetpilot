import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
    }),
    // Copy icon.ico to dist root for electron-builder
    {
      name: 'copy-icon',
      closeBundle() {
        const iconSrc = path.resolve(__dirname, '../assets/images/icon.ico');
        const iconDest = path.resolve(__dirname, '../../dist/icon.ico');
        if (fs.existsSync(iconSrc)) {
          fs.copyFileSync(iconSrc, iconDest);
        }
      }
    }
  ],
  base: './', // Use relative paths for assets in production builds
  resolve: {
    alias: {
      '/fonts': path.resolve(__dirname, 'assets/fonts'),
      '@emotion/react': path.resolve(__dirname, '../node_modules/@emotion/react'),
      '@emotion/styled': path.resolve(__dirname, '../node_modules/@emotion/styled'),
    },
  },
  optimizeDeps: {
    include: [
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      '@mui/icons-material',
      '@mui/lab',
    ],
  },
  assetsInclude: ['**/*.ttf', '**/*.woff', '**/*.woff2', '**/*.ico'],
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
    minify: 'esbuild', // Enable fast minification for production builds
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
