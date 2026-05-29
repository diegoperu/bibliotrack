import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,   // bind 0.0.0.0 — accessibile da Android/altri dispositivi in LAN
    proxy: {
      '/auth':   { target: 'http://localhost:8000', changeOrigin: true },
      '/books':  { target: 'http://localhost:8000', changeOrigin: true },
      '/users':  { target: 'http://localhost:8000', changeOrigin: true },
      '/isbn':   { target: 'http://localhost:8000', changeOrigin: true },
      '/static': { target: 'http://localhost:8000', changeOrigin: true },
      '/health': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
