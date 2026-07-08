import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
  build: {
    // Relying on Vite's default chunking strategy to prevent undefined React exports
  },
  server: {
    host: true,
    allowedHosts: [
      "pagodalike-dannielle-stageably.ngrok-free.dev",
      "localhost",
      "127.0.0.1",
      ".ngrok-free.dev"
    ],
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  }
})
