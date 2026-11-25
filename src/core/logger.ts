import { APP_ERROR_CODES, type AppErrorCode } from '@/core/errors';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogSink = (level: LogLevel, code: AppErrorCode) => void;

/** Envía únicamente códigos del catálogo al destino de logs. */
export function createLogger(sink: LogSink) {
  function write(level: LogLevel, code: AppErrorCode): void {
    if (process.env.NODE_ENV === 'production' && (level === 'debug' || level === 'info')) {
      return;
    }
    if (APP_ERROR_CODES.includes(code)) {
      sink(level, code);
    }
  }

  return {
    debug: (code: AppErrorCode) => write('debug', code),
    info: (code: AppErrorCode) => write('info', code),
    warn: (code: AppErrorCode) => write('warn', code),
    error: (code: AppErrorCode) => write('error', code),
  };
}
