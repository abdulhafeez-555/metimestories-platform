import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Frontend runs on http://localhost:5173
// Backend (Hafeez's platform) runs on http://localhost:3000
// All /api/* calls are proxied straight through to the backend so the
// browser never has to deal with cross-origin requests during local dev.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
