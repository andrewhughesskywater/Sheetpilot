import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [
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
      },
    },
  ];

  // Bundle analyzer - only in production build with ANALYZE=true
  if (mode === 'production' && process.env['ANALYZE'] === 'true') {
    plugins.push(
      visualizer({
        filename: './dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      }) as unknown as PluginOption
    );
  }

  return {
    plugins,
    base: './', // Use relative paths for assets in production builds
    resolve: {
      alias: {
        '@sheetpilot/shared': path.resolve(__dirname, '../../shared/index.ts'),
        '/fonts': path.resolve(__dirname, 'assets/fonts'),
        '@emotion/react': path.resolve(__dirname, '../../../../node_modules/@emotion/react'),
        '@emotion/styled': path.resolve(__dirname, '../../../../node_modules/@emotion/styled'),
        '@/components': path.resolve(__dirname, '../components'),
        '@/contexts': path.resolve(__dirname, '../contexts'),
        '@/hooks': path.resolve(__dirname, '../hooks'),
        '@/utils': path.resolve(__dirname, '../utils'),
        '@/services': path.resolve(__dirname, '../services'),
        '@/contracts': path.resolve(__dirname, '../contracts'),
        '@/config': path.resolve(__dirname, '../config'),
        '@/styles': path.resolve(__dirname, '../styles'),
        '@/assets': path.resolve(__dirname, '../assets'),
      },
    },
    optimizeDeps: {
      include: [
        '@emotion/react',
        '@emotion/react/jsx-runtime',
        '@emotion/styled',
        '@mui/material',
        '@mui/styled-engine',
        '@mui/icons-material',
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
            handsontable: ['handsontable', '@handsontable/react-wrapper'],
          },
        },
      },
      chunkSizeWarningLimit: 800, // Increase to accommodate larger react-vendor chunk
      target: 'esnext', // Use modern ES features
      minify: 'terser', // Use terser for better minification
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
        format: {
          comments: false,
        },
      },
    },
    // Development server configuration
    server: {
      headers: {
        // More permissive CSP for development (allows hot reloading)
        'Content-Security-Policy':
          mode === 'development'
            ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' ws: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:;"
            : "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:;",
      },
    },
  };
});
