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
         '@': '/src',
      },
    },
    server: {
      proxy: {
        '/api/drive': {
          target: env.VITE_DRIVE_API_BASE_URL || 'http://localhost:8081',
          changeOrigin: true,
        },
        '/api/cards': {
          target: env.VITE_DRIVE_API_BASE_URL || 'http://localhost:8081',
          changeOrigin: true,
        },
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8080',
          changeOrigin: true,
        }
      }
    }
  }
})
