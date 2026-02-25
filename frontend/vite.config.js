import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Esto es lo mismo que --host
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:3000', // El nombre del servicio en Docker
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true, // Esto ayuda a que el Hot Reload de React sea más estable en Windows
    }
  },
})