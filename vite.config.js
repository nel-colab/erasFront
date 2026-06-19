import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      vue(),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: parseInt(env.VITE_DEV_PORT) || 5173,
      host: true,
      proxy: {
        '/api/drive': {
          target: env.VITE_DRIVE_API_BASE_URL || 'http://localhost:8081',
          changeOrigin: true,
        },
        '/api/cards': {
          target: env.VITE_DRIVE_API_BASE_URL || 'http://localhost:8081',
          changeOrigin: true,
        },
        '/api/simulator': {
          target: env.VITE_DRIVE_API_BASE_URL || 'http://localhost:8081',
          changeOrigin: true,
        },
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8080',
          changeOrigin: true,
        },
        '/ws': {
          target: env.VITE_DRIVE_API_BASE_URL || 'http://localhost:8081',
          ws: true,
          changeOrigin: true,
        },
      }
    }
  }
})
