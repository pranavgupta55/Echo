// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // proxy /api/* to http://localhost:8000/api/*
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // if your FastAPI routes keep the /api prefix, you can omit `rewrite`
        // rewrite: (path) => path.replace(/^\/api/, '')
      },
    },
  },
})
