import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Solo localhost di default (CVE dev server Vite 5); LAN: npm run dev -- --host
  },
})
