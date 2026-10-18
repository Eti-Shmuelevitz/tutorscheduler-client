import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The API's CORS policy only allows http://localhost:5173. Without
    // strictPort, Vite silently moves to 5174 when 5173 is busy and every
    // API call then fails with an opaque CORS error - fail loudly instead.
    port: 5173,
    strictPort: true,
  },
})
