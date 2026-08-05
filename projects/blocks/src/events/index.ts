// 統一事件路由脊椎。區塊發語義事件(命名仿 GA4);宿主裝「一個」router,
// router 有 execute(命令→行為)+ sinks(觀察→追蹤目的地 fan-out)。
// 同一手勢 → 一個事件 → 同時 execute + 送所有 sinks;命令型才 execute,全部都追蹤。
export * from './event'
export * from './context'
export * from './router'
