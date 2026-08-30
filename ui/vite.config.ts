import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The hub (backend) runs on TARTARUS_UI_PORT (default 8799). In dev we proxy the
// API + SSE stream to it so the dashboard and backend share an origin.
const HUB = process.env.TARTARUS_HUB ?? 'http://localhost:8799';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    proxy: {
      '/api': { target: HUB, changeOrigin: true },
    },
  },
  build: { outDir: 'dist' },
});
