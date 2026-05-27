import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  logLevel: 'error',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('if-none-match');
            proxyReq.removeHeader('if-modified-since');
          });
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['etag'];
            delete proxyRes.headers['last-modified'];
            proxyRes.headers['cache-control'] = 'no-store, no-cache, must-revalidate';
          });
        },
      },
    },
  },
  plugins: [react()],
});
