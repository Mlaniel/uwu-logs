import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/top': 'http://localhost:5020',
      '/pve_stats': 'http://localhost:5020',
      '/character': 'http://localhost:5020',
      '/upload': 'http://localhost:5010',
      '/upload_progress': 'http://localhost:5010',
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
