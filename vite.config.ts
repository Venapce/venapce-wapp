import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Optional dev proxy: set VITE_SUPERSET_PROXY_TARGET to route browser
    // calls through Vite and sidestep CORS entirely during development.
    // Then connect using base URL "/superset" in the Connect page.
    proxy: process.env.VITE_SUPERSET_PROXY_TARGET
      ? {
          '/superset': {
            target: process.env.VITE_SUPERSET_PROXY_TARGET,
            changeOrigin: true,
            secure: false,
            rewrite: (p) => p.replace(/^\/superset/, ''),
          },
        }
      : undefined,
  },
})
