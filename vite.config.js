import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Vercel static: 404.html = index.html omogućava /login i druge React rute */
function spaFallback404() {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist')
      const index = path.join(dist, 'index.html')
      const notFound = path.join(dist, '404.html')
      if (fs.existsSync(index)) fs.copyFileSync(index, notFound)
    },
  }
}

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
  plugins: [react(), spaFallback404()],
});
