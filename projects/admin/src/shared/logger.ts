// 前端 logger:分級 + 命名空間 + 依環境收斂。
// 不引第三方(pino / winston 那類是 Node 取向,瀏覽器端只會多打包一包)——
// 這層要的是「production 不要噴 debug、每行看得出來自哪個模組」,console 包一層就夠。
//
// 之後要接遠端收集(Sentry / 自家 collector)時,只在 emit 裡多一個出口,呼叫端不動。

const LEVELS = ['debug', 'info', 'warn', 'error'] as const
export type LogLevel = (typeof LEVELS)[number]

// dev 全開;production 只留 warn 以上,避免把使用者 console 洗掉、也不外洩內部細節。
// VITE_LOG_LEVEL 可覆寫(例:線上臨時查問題設成 debug)。
const configured = import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined
const threshold: LogLevel = configured ?? (import.meta.env.DEV ? 'debug' : 'warn')
const enabled = (level: LogLevel) => LEVELS.indexOf(level) >= LEVELS.indexOf(threshold)

const sinks: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
}

function emit(level: LogLevel, scope: string, args: unknown[]): void {
  if (!enabled(level)) return
  sinks[level](`[${scope}]`, ...args)
}

export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

/** 取一個掛了命名空間的 logger,例:`const log = logger('home')`。 */
export function logger(scope: string): Logger {
  return {
    debug: (...args) => emit('debug', scope, args),
    info: (...args) => emit('info', scope, args),
    warn: (...args) => emit('warn', scope, args),
    error: (...args) => emit('error', scope, args),
  }
}
