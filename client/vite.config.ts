import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['mermaid', 'dayjs', '@braintree/sanitize-url', 'elkjs/lib/elk.bundled.js'],
  },
  server: { proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true, ws: true } } },
  preview: { proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true, ws: true } } },
});
