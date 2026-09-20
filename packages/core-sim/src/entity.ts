/**
 * Nesil etiketli (generational) varlik tanitici.
 *
 * Bir tanitici tek bir int32 icine paketlenir:
 *
 *   bit  0..19  slot  (1.048.576 slot)
 *   bit 20..30  nesil (2048 nesil)
 *
 * Slot yeniden kullanildiginda nesil artar, boylece eski bir taniticiyi
 * tutan kod yeni varliga yanlislikla erisemez: `isAlive` false doner.
 *
 * Nesil hicbir zaman 0 olmaz, dolayisiyla gecerli bir tanitici hicbir zaman
 * 0 degildir; `NULL_ENTITY` bu yuzden guvenle 0'dir.
 */

/** Varlik tanitici. Duz `number` ile karistirilamaz. */
export type Entity = number & { readonly __entity: true };

const SLOT_BITS = 20;
const SLOT_MASK = 0xfffff;
const GENERATION_MASK = 0x7ff;

/** Bir slotun tasiyabilecegi en buyuk slot sayisi. */
export const MAX_SLOTS = 1 << SLOT_BITS;

/** İlk nesil. 0 kullanilmaz ki gecerli tanitici NULL_ENTITY'ye esit olmasin. */
export const FIRST_GENERATION = 1;

/** Hicbir varligi gostermeyen tanitici. */
export const NULL_ENTITY = 0 as Entity;

/** Slot ve nesilden tanitici uretir. */
export function makeEntity(slot: number, generation: number): Entity {
  return (((generation & GENERATION_MASK) << SLOT_BITS) | (slot & SLOT_MASK) | 0) as Entity;
}

/** Taniticinin slot numarasi. */
export function entitySlot(entity: Entity): number {
  return entity & SLOT_MASK;
}

/** Taniticinin nesli. */
export function entityGeneration(entity: Entity): number {
  return (entity >>> SLOT_BITS) & GENERATION_MASK;
}

/** Nesli bir arttirir; 0'i atlar. */
export function nextGeneration(generation: number): number {
  const next = (generation + 1) & GENERATION_MASK;
  return next === 0 ? FIRST_GENERATION : next;
}
