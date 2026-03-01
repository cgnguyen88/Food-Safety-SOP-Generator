import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/claude': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: () => '/v1/messages',
          // Server-side key injection for local/demo backend proxy usage.
          headers: {
            'anthropic-dangerous-direct-browser-access': 'true',
            ...(env.ANTHROPIC_API_KEY
              ? {
                  'x-api-key': env.ANTHROPIC_API_KEY,
                  'anthropic-version': '2023-06-01',
                }
              : {}),
          },
        },
      },
    },
  }
})
