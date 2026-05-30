import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/static': 'http://localhost:5000',
      '/upload': 'http://localhost:5000',
      '/upload_progress': 'http://localhost:5000',

      // POST-only — no page behind these, always proxy
      '/top_points':  'http://localhost:5000',
      '/top_speedrun': 'http://localhost:5000',
      '/rank': 'http://localhost:5000',

      // GET /top is the Vue Rankings page; POST /top is the API.
      // Bypass GET so Vite serves index.html and Vue Router handles it.
      '/top': {
        target: 'http://localhost:5000',
        bypass(req) {
          return req.method === 'GET' ? req.url : null
        },
      },

      // GET /pve_stats is a Vue page; POST /pve_stats is the API.
      '/pve_stats': {
        target: 'http://localhost:5000',
        bypass(req) {
          return req.method === 'GET' ? req.url : null
        },
      },

      // GET /character  (no sub-path) is the Vue Character page.
      // GET /character/<server>/<name>/<spec> is a data API — must proxy.
      // POST /character is also a data API — must proxy.
      '/character': {
        target: 'http://localhost:5000',
        bypass(req) {
          const pathname = req.url?.split('?')[0]
          return req.method === 'GET' && pathname === '/character' ? req.url : null
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
