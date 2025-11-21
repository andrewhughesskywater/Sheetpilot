import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  
  // Tauri expects a fixed port for development
  server: {
    port: 1420,
    strictPort: true,
  },
  
  // Tauri uses environment variables prefixed with VITE_ or TAURI_
  envPrefix: ['VITE_', 'TAURI_'],
  
  // Optimize build for size
  build: {
    // Tauri uses Chromium for rendering, so we can target modern browsers
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Remove console logs in production
      }
    },
    rollupOptions: {
      output: {
        // manualChunks will be added when we add handsontable
      }
    }
  },
  
  clearScreen: false,
});

