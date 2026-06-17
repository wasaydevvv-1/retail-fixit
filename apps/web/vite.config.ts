import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API + websocket to the backend during local dev.
      '/api': 'http://localhost:4000',
      '/realtime': { target: 'ws://localhost:4000', ws: true },
    },
  },
});
