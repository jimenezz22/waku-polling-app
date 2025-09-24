import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Required for Waku
  optimizeDeps: {
    exclude: ['@waku/sdk']
  },

  server: {
    port: 3000,
    open: true
  },

  define: {
    global: 'globalThis'
  }
})
