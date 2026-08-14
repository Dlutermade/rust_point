import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
// 具名匯出 —— 套件 README 寫的 default import 已過時(2.4.2 沒有 default export)。
import { mockDevServerPlugin } from 'vite-plugin-mock-dev-server'

// https://vite.dev/config/
// tanstackRouter 掃 src/routes/ 自動產生 routeTree.gen.ts(必須排在 react 之前)。
export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react' }),
    react(),
    tailwindcss(),
    // 讀下方 server.proxy 決定攔哪些路徑,把 mock/**/*.mock.ts 掛進 dev server。
    // 對客戶端零侵入 —— service 層永遠只有「打 http」一條路徑,不帶 mock 分支。
    // 要改打真後端就把 mock 檔停用(或刪掉),前端程式碼一行都不用動。
    mockDevServerPlugin(),
  ],
  // 編輯 API 打 storefront-center(cargo run,預設 BIND_ADDR=0.0.0.0:3000)。
  // http.ts 的 baseURL 是 /api,所以這裡不改寫路徑。
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
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
