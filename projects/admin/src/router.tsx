import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

// 路由改為 file-based:路由定義在 src/routes/*,tanstackRouter 外掛掃描產生 routeTree.gen.ts。
export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
