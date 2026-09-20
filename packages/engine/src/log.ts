/**
 * Seviyeli gunluk.
 *
 * `console` bu depoda YALNIZCA burada kullanilir (ESLint zorlar). Cikti bir
 * "sink" araciligiyla verilir; testler kendi sink'ini gecerek cikti bicimini
 * tarayici olmadan dogrulayabilir.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

const ORDER: Readonly<Record<LogLevel, number>> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5,
};

/** Gunluk satirini alan hedef. */
export type LogSink = (level: Exclude<LogLevel, 'silent'>, message: string) => void;

export interface Logger {
  readonly level: LogLevel;
  trace(message: string): void;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** Ayni hedefe yazan, ad onekli bir alt gunluk. */
  child(name: string): Logger;
}

/** Bir seviyenin verilen esige gore yazilip yazilmayacagi. */
export function isEnabled(level: LogLevel, threshold: LogLevel): boolean {
  return ORDER[level] >= ORDER[threshold] && threshold !== 'silent';
}

/** Metnin gecerli bir seviye olup olmadigi. */
export function isLogLevel(value: string): value is LogLevel {
  return Object.prototype.hasOwnProperty.call(ORDER, value);
}

/** Varsayilan hedef: tarayici konsolu. */
export const consoleSink: LogSink = (level, message) => {
  switch (level) {
    case 'error':
      // eslint-disable-next-line no-console
      console.error(message);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(message);
      break;
    default:
      // eslint-disable-next-line no-console
      console.log(message);
      break;
  }
};

/** Gunluk olusturur. */
export function createLogger(
  level: LogLevel = 'info',
  sink: LogSink = consoleSink,
  prefix = '',
): Logger {
  const write = (at: Exclude<LogLevel, 'silent'>, message: string): void => {
    if (!isEnabled(at, level)) return;
    sink(at, prefix === '' ? message : `${prefix} ${message}`);
  };

  return {
    level,
    trace: (message) => {
      write('trace', message);
    },
    debug: (message) => {
      write('debug', message);
    },
    info: (message) => {
      write('info', message);
    },
    warn: (message) => {
      write('warn', message);
    },
    error: (message) => {
      write('error', message);
    },
    child: (name) => createLogger(level, sink, prefix === '' ? `[${name}]` : `${prefix}[${name}]`),
  };
}
