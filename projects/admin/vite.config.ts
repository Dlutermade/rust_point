import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
// tanstackRouter 掃 src/routes/ 自動產生 routeTree.gen.ts(必須排在 react 之前)。
export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react' }),
    react(),
    tailwindcss(),
  ],
  // 兩個獨立打包端點:admin SPA(index.html)與前台預覽(preview.html)各自成 bundle,
  // 不共用 router / provider / 全域狀態 → 互不汙染。
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        preview: 'preview.html',
      },
    },
  },
})
