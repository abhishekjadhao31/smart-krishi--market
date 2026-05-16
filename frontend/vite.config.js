import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for Smart Krishi Market frontend.
// Dev server runs on 5173; proxies /api to backend (default :4000) so we
// don't have to deal with CORS during local development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
