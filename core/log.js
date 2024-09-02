import { config } from './index.js'

export function error(...data) {
  if (config.core?.debug === 'silent') return
  console.group(`[Error] Ease: ${data[0]}`)
  data.slice(1).forEach((v) => console.error(v))
  console.groupEnd();
  return {
    toError: () => new Error(data.toString())
  }
}

export function warn(...data) {
  if (!config.core?.debug) return
  console.group(`[Warn] Ease: ${data[0]}`)
  data.slice(1).forEach((v) => console.warn(v))
  console.groupEnd();
  return {
    toError: () => new Error(data.toString())
  }
}

export function log(...data) {
  if (!config.core?.debug) return
  console.group(`[Log] Ease: ${data[0]}`)
  data.slice(1).forEach((v) => console.log(v))
  console.groupEnd();
  return {
    toError: () => new Error(data.toString())
  }
}

export function info(...data) {
  if (!config.core?.debug || config.core.debug !== 'verbose') return
  console.group(`[Info] Ease: ${data[0]}`)
  data.slice(1).forEach((v) => console.info(v))
  console.groupEnd();
  return {
    toError: () => new Error(data.toString())
  }
}
