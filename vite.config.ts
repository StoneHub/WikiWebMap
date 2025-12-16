import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Use polling for WSL2 + Windows filesystem compatibility
      usePolling: true,
      interval: 1000,
    },
  },
})
