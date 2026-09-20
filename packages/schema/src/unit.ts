/**
 * Birim tanimi semasi.
 *
 * Birimin kimligi TOML tablo anahtarindan gelir (`[unit.soldier]`), govdede
 * tekrar edilmez. Faz 0'da yalnizca hareket ve saglik alanlari vardir; savas,
 * uretim ve gorsel alanlar sonraki fazlarda eklenecek.
 */
import * as z from 'zod';
import { DisplayNameSchema, SlugSchema } from './primitives';

export const UnitSchema = z.strictObject({
  /** Goruntuleme adi. */
  name: DisplayNameSchema,
  /** Ait oldugu fraksiyonun kimligi. `link` asamasinda sayisal kimlige cozulur. */
  faction: SlugSchema,
  /** Azami saglik. Tam sayi. */
  maxHealth: z.int().positive().max(1000000),
  /** Hiz, dunya birimi / saniye. Tick'e donusum sim'in isidir. */
  speed: z.number().nonnegative().max(1000),
  /** Donus hizi, derece / saniye. */
  turnRate: z.number().positive().max(3600),
  /** Carpisma yaricapi, dunya birimi. */
  radius: z.number().positive().max(100),
});

/** Dogrulanmis birim tanimi (henuz baglanmamis, referanslar hala metin). */
export type UnitData = z.infer<typeof UnitSchema>;
