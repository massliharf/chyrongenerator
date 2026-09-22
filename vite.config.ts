import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/chyrongenerator/',
  plugins: [react()],
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { 'font-engine': ['opentype.js'] },
      },
    },
  },
})
