import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// 區塊庫 library build:輸出 ESM + 型別宣告(.d.ts)。
// 型別走編譯後的 .d.ts(decorator 已抹除)→ 消費端(admin)不必開 experimentalDecorators。
// lit 設為 external → 由消費端去重,不重複打包。
// dev(vite)仍服務 index.html demo,不受 lib 設定影響。
export default defineConfig({
  plugins: [dts({ include: ['src'] })],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'blocks',
    },
    rollupOptions: {
      external: [/^lit($|\/)/],
    },
  },
})
