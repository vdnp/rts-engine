/**
 * İcerik dosyalarinda tekrar eden temel bicimler.
 *
 * Kimlikler kucuk harf slug'dir: `[a-z][a-z0-9_]*`. Bu kisit hem TOML tablo
 * anahtarlarini tirnaksiz yazilabilir tutar hem de buyuk/kucuk harf farkindan
 * dogan platform sorunlarini engeller.
 */
import * as z from 'zod';

/** Kimlik bicimi. */
export const SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;

/** Surum bicimi: MAJOR.MINOR.PATCH. */
export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Surum araligi bicimi. Desteklenenler:
 * `*` (herhangi), `1.2.3` (tam), `=1.2.3`, `>1.2.3`, `>=1.2.3`, `<1.2.3`,
 * `<=1.2.3`, `^1.2.3` (ayni major), `~1.2.3` (ayni major.minor).
 */
export const VERSION_RANGE_PATTERN = /^(\*|(=|>=|<=|>|<|\^|~)?\d+\.\d+\.\d+)$/;

/** Kimlik semasi. */
export const SlugSchema = z.string().regex(SLUG_PATTERN);

/** Surum semasi. */
export const VersionSchema = z.string().regex(VERSION_PATTERN);

/** Surum araligi semasi. */
export const VersionRangeSchema = z.string().regex(VERSION_RANGE_PATTERN);

/** Bos olmayan goruntuleme metni. */
export const DisplayNameSchema = z.string().min(1).max(120);

/** 0-255 araliginda renk bileseni. */
const ColorChannelSchema = z.int().min(0).max(255);

/** RGB renk, 0-255 uclusu. */
export const ColorSchema = z.tuple([ColorChannelSchema, ColorChannelSchema, ColorChannelSchema]);

/** RGB renk. */
export type Color = z.infer<typeof ColorSchema>;
