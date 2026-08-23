import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 18861,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:18860',
        changeOrigin: true,
        ws: true,
      },
      '/go2rtc': {
        target: 'http://127.0.0.1:18864',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/go2rtc/, ''),
        ws: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000
  }
});
