/**
 * Fraksiyon tanimi semasi.
 *
 * Fraksiyonun kimligi TOML tablo anahtarindan gelir (`[faction.x]`).
 * `units` listesi `[append.faction.x.units]` ile genisletilebilir.
 */
import * as z from 'zod';
import { ColorSchema, DisplayNameSchema, SlugSchema } from './primitives';

export const FactionSchema = z.strictObject({
  /** Goruntuleme adi. */
  name: DisplayNameSchema,
  /** Oyuncu rengi, RGB 0-255. */
  color: ColorSchema,
  /** Bu fraksiyona ait birim kimlikleri. `link` asamasinda cozulur. */
  units: z.array(SlugSchema).default([]),
});

/** Dogrulanmis fraksiyon tanimi (henuz baglanmamis). */
export type FactionData = z.infer<typeof FactionSchema>;
