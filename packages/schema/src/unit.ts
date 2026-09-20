/**
 * Birim tanimi semasi.
 *
 * Birimin kimligi TOML tablo anahtarindan gelir (`[unit.soldier]`), govdede
 * tekrar edilmez. Birimin hangi fraksiyona ait oldugu da burada yazmaz: uyelik
 * tek kaynaktan, fraksiyonun kadro listesinden (`faction.<id>.units`) gelir ve
 * `link` asamasinda cozulur.
 *
 * Faz 0'da yalnizca hareket ve saglik alanlari vardir; savas, uretim ve gorsel
 * alanlar sonraki fazlarda eklenecek.
 */
import * as z from 'zod';
import { DisplayNameSchema } from './primitives';

export const UnitSchema = z.strictObject({
  /** Goruntuleme adi. */
  name: DisplayNameSchema,
  /** Azami saglik. Tam sayi. */
  maxHealth: z.int().positive().max(1000000),
  /** Hiz, dunya birimi / saniye. Tick'e donusum sim'in isidir. */
  speed: z.number().nonnegative().max(1000),
  /** Donus hizi, derece / saniye. */
  turnRate: z.number().positive().max(3600),
  /** Carpisma yaricapi, dunya birimi. */
  radius: z.number().positive().max(100),
});

/** Dogrulanmis birim tanimi (henuz baglanmamis). */
export type UnitData = z.infer<typeof UnitSchema>;
