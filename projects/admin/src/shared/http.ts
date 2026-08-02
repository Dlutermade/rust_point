import axios from 'axios'

// 全功能共用的 HTTP 實例:統一 baseURL + 攔截器(塞 token / 統一錯誤)。
// 各 feature 的 api 都走這;真後端接上前,dev 資料源仍是各自的 mock。
export const http = axios.create({
  baseURL: '/api',
  timeout: 15_000,
})

// 請求:統一帶上登入 token。
http.interceptors.request.use((config) => {
  const token = globalThis.localStorage?.getItem('sf:token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
