/**
 * Mod manifest semasi (`manifest.toml`).
 *
 * `content/base/` dahil her icerik paketinde bir manifest bulunur. Vanilla
 * icerik ozel muamele gormez; yukleyici icin o da diger paketler gibidir.
 */
import * as z from 'zod';
import { DisplayNameSchema, SlugSchema, VersionRangeSchema, VersionSchema } from './primitives';

export const ManifestSchema = z.strictObject({
  /** Paket kimligi. Dizin adiyla ayni olmalidir. */
  id: SlugSchema,
  /** Goruntuleme adi. */
  name: DisplayNameSchema,
  /** Paket surumu. */
  version: VersionSchema,
  /** Kisa aciklama. */
  description: z.string().max(500).optional(),
  /** Yazar. */
  author: z.string().max(120).optional(),
  /**
   * Bagimliliklar: paket kimligi -> surum araligi.
   * Yukleme sirasi bu grafigin topolojik siralamasidir.
   */
  dependencies: z.record(SlugSchema, VersionRangeSchema).default({}),
});

/** Dogrulanmis manifest. */
export type Manifest = z.infer<typeof ManifestSchema>;
