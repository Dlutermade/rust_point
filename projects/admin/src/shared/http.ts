import axios from 'axios'

import { logger } from './logger'

const log = logger('http')

// 全功能共用的 HTTP 實例:統一 baseURL + 統一錯誤記錄。
// 各 feature 的 api 都走這;真後端接上前,dev 資料源仍是各自的 mock。
//
// 註:v1 沒有登入系統(見 service/storefront/shared/types.ts 的 audit 說明),所以這裡不塞 token。
// 認證進場時再補 request 攔截器。
export const http = axios.create({
  baseURL: '/api',
  timeout: 15_000,
})

// 失敗一律留一筆記錄再往外丟 —— 不吞錯,呼叫端的 catch / react-query 行為不變。
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const { config, response } = error
      log.error(
        `${config?.method?.toUpperCase() ?? '?'} ${config?.url ?? '?'}`,
        response ? `→ ${response.status}` : `→ ${error.code ?? 'network error'}`,
        response?.data ?? error.message,
      )
    } else {
      log.error('非預期錯誤', error)
    }
    return Promise.reject(error)
  },
)
