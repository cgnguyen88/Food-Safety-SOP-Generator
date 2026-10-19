import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API runs as its own local server in development (server/index.js); Vite forwards /api to it.
// Its port differs from the Organic app's (3001) so both can run at once.
const API_PORT = Number(process.env.API_PORT) || 3002

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['api/**/*.test.js', 'server/**/*.test.js', 'supabase/**/*.test.js', 'scripts/**/*.test.js', 'src/**/*.test.{js,jsx}'],
    restoreMocks: true,
  },
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
