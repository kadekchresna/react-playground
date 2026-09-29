import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The frontend always talks to the Express service over real HTTP (PRD §4).
// In dev, Vite proxies /api to the Express port so there is no CORS ceremony
// and no second origin — the browser still crosses a process boundary.
const API_ORIGIN = 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_ORIGIN,
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
  },
});
