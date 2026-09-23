/**
 * Ortam degiskenlerinin TEK okuma noktasi.
 *
 * Baska hicbir dosya `import.meta.env` veya `process.env` okumaz. Degerler
 * burada zod ile ayristirilir, tipli bir nesne olarak disari verilir ve bozuk
 * bir deger sessizce varsayilana dusmek yerine anlasilir bir hata verir.
 *
 * `.env` OLMADAN da calisir: her alanin bir varsayilani vardir.
 */
import type { LogLevel } from '@bfme/engine';
import * as z from 'zod';

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'silent'] as const;

const TRUE_WORDS = ['true', '1', 'yes', 'on'];
const FALSE_WORDS = ['false', '0', 'no', 'off'];

/** Bos ya da tanimsiz degeri varsayilana cevirir, digerini olduğu gibi birakir. */
function withDefault<T>(fallback: T) {
  return (raw: string | undefined): string | T =>
    raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

function boolField(fallback: boolean, name: string) {
  return z
    .string()
    .optional()
    .transform(withDefault(fallback))
    .transform((value, ctx) => {
      if (typeof value === 'boolean') return value;
      const lowered = value.toLowerCase();
      if (TRUE_WORDS.includes(lowered)) return true;
      if (FALSE_WORDS.includes(lowered)) return false;
      ctx.addIssue({
        code: 'custom',
        message: `${name}: "true" veya "false" bekleniyordu, "${value}" bulundu.`,
      });
      return z.NEVER;
    });
}

function intField(fallback: number, name: string, min: number, max: number) {
  return z
    .string()
    .optional()
    .transform(withDefault(fallback))
    .transform((value, ctx) => {
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        ctx.addIssue({
          code: 'custom',
          message: `${name}: ${String(min)}..${String(max)} araliginda tam sayi bekleniyordu, "${String(value)}" bulundu.`,
        });
        return z.NEVER;
      }
      return parsed;
    });
}

function logLevelField(fallback: LogLevel, name: string) {
  return z
    .string()
    .optional()
    .transform(withDefault<LogLevel>(fallback))
    .transform((value, ctx) => {
      const lowered = value.toLowerCase();
      if ((LOG_LEVELS as readonly string[]).includes(lowered)) return lowered as LogLevel;
      ctx.addIssue({
        code: 'custom',
        message: `${name}: ${LOG_LEVELS.join(' | ')} bekleniyordu, "${value}" bulundu.`,
      });
      return z.NEVER;
    });
}

/** Virgulle ayrilmis liste; sira korunur, bos ogeler atilir. */
function listField(fallback: string, name: string) {
  return z
    .string()
    .optional()
    .transform(withDefault(fallback))
    .transform((value, ctx) => {
      const items = String(value)
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (items.length === 0) {
        ctx.addIssue({ code: 'custom', message: `${name}: en az bir oge gerekli.` });
        return z.NEVER;
      }
      return items;
    });
}

const EnvSchema = z.object({
  VITE_BFME_LOG_LEVEL: logLevelField('debug', 'VITE_BFME_LOG_LEVEL'),
  VITE_BFME_ENABLED_MODS: listField('base', 'VITE_BFME_ENABLED_MODS'),
  VITE_BFME_HOT_RELOAD: boolField(true, 'VITE_BFME_HOT_RELOAD'),
  VITE_BFME_SIM_TRACE: boolField(false, 'VITE_BFME_SIM_TRACE'),
  VITE_BFME_TICK_RATE: intField(30, 'VITE_BFME_TICK_RATE', 1, 240),
  VITE_BFME_SHOW_STATS: boolField(true, 'VITE_BFME_SHOW_STATS'),
  VITE_BFME_SEED: intField(42, 'VITE_BFME_SEED', 0, 0xffffffff),
});

/** Uygulamanin tipli yapilandirmasi. */
export interface AppConfig {
  readonly logLevel: LogLevel;
  /** Yuklenecek icerik paketleri, yukleme sirasinda. */
  readonly enabledMods: readonly string[];
  readonly hotReload: boolean;
  /** Her tick'te durum hash'ini gunluge yaz. Yavastir. */
  readonly simTrace: boolean;
  /**
   * Dongunun tick hizi. YALNIZCA gelistirme icindir.
   *
   * Sim'in tick basina adimi `core-sim`'in kendi `TICK_RATE` sabitinden
   * turer; burayi degistirmek birimlerin gorunur hizini degistirir ama
   * sim'in ic hesabini degistirmez.
   */
  readonly tickRate: number;
  readonly showStats: boolean;
  /** Demo senaryosunun tohumu. */
  readonly seed: number;
}

/** Yapilandirma okunamadiginda firlatilir. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Ham ortam tablosundan yapilandirma uretir.
 *
 * Saf fonksiyondur: `import.meta.env` okumaz, bu yuzden tarayici olmadan
 * tam olarak test edilir.
 */
export function parseConfig(raw: Readonly<Record<string, string | undefined>>): AppConfig {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.message}`);
    throw new ConfigError(`Ortam degiskenleri okunamadi:\n${lines.join('\n')}`);
  }
  const env = result.data;
  return {
    logLevel: env.VITE_BFME_LOG_LEVEL,
    enabledMods: env.VITE_BFME_ENABLED_MODS,
    hotReload: env.VITE_BFME_HOT_RELOAD,
    simTrace: env.VITE_BFME_SIM_TRACE,
    tickRate: env.VITE_BFME_TICK_RATE,
    showStats: env.VITE_BFME_SHOW_STATS,
    seed: env.VITE_BFME_SEED,
  };
}

/**
 * Calisma anindaki yapilandirma.
 *
 * `import.meta.env` DEPODA YALNIZCA burada okunur.
 */
export function readConfig(): AppConfig {
  return parseConfig(import.meta.env);
}
