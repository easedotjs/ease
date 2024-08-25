import { config } from './index.js'

export function error(...data) {
  if (!config.core?.debug) return;
  console.group('[Error] Ease:');
  console.error(...data);
  console.groupEnd();
}

export function warn(...data) {
  if (!config.core?.debug) return;
  console.group('[Warn] Ease:');
  console.warn(...data);
  console.groupEnd();
}

export function log(...data) {
  if (!config.core?.debug) return;
  console.group('[Log] Ease:');
  console.log(...data);
  console.groupEnd();
}

export function info(...data) {
  if (!config.core?.debug || config.core.debug !== 'verbose') return;
  console.group('Ease:');
  console.info(...data);
  console.groupEnd();
}
