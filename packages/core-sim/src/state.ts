/**
 * SoA (Structure of Arrays) varlik deposu ve simulasyon durumu.
 *
 * Her bilesen alani kendi tipli dizisidir ve slot numarasiyla indekslenir.
 * Tum sayisal alanlar `Int32Array`'dir: konum, hiz ve yaricap Q16.16
 * fixed-point, yon ise BAM16 acidir. Float hicbir yerde tutulmaz.
 *
 * Sistemler slotlari 0'dan `highWater`'a kadar SIRAYLA gezer ve olu slotlari
 * atlar. Sira sabit oldugu icin gezinme deterministiktir.
 */
import { DEFAULT_CAPACITY } from './constants';
import {
  type Entity,
  FIRST_GENERATION,
  MAX_SLOTS,
  entityGeneration,
  entitySlot,
  makeEntity,
  nextGeneration,
} from './entity';

/** Q16.16 veya BAM16 degerler tutan bilesen alanlari. */
export const I32_FIELDS = [
  'generation',
  'unitType',
  'owner',
  'posX',
  'posY',
  'facing',
  'velX',
  'velY',
  'targetX',
  'targetY',
  'health',
  'maxHealth',
] as const;

/** Bayrak alanlari. */
export const U8_FIELDS = ['alive', 'moving'] as const;

export type I32Field = (typeof I32_FIELDS)[number];
export type U8Field = (typeof U8_FIELDS)[number];

/** Degistirilebilir simulasyon durumu. Yalnizca `tick` buna yazar. */
export type SimState = {
  /** Islenmis tick sayisi. */
  tick: number;
  /** Ayrilmis slot sayisi. */
  capacity: number;
  /** Kullanilmis en yuksek slot + 1. Sistemler bu araligi gezer. */
  highWater: number;
  /** Yasayan varlik sayisi. */
  entityCount: number;
  /** Serbest slot yigini (LIFO). */
  freeSlots: Int32Array;
  /** Yigindaki gecerli eleman sayisi. */
  freeCount: number;
} & { [K in I32Field]: Int32Array } & { [K in U8Field]: Uint8Array };

/** Yazma yontemleri olmayan tipli dizi gorunumu. */
export interface ReadonlyI32Array {
  readonly length: number;
  readonly [index: number]: number;
}

/** Yazma yontemleri olmayan bayrak dizisi gorunumu. */
export interface ReadonlyU8Array {
  readonly length: number;
  readonly [index: number]: number;
}

/**
 * Present katmaninin gordugu tip. Dizilerin `set`/`fill` gibi yazma
 * yontemleri gorunmez, alanlar `readonly`'dir: sim durumunu goruntuleme
 * tarafindan degistirmek DERLEME hatasidir.
 */
export type ReadonlySimState = {
  readonly [K in keyof SimState]: SimState[K] extends Int32Array
    ? ReadonlyI32Array
    : SimState[K] extends Uint8Array
      ? ReadonlyU8Array
      : SimState[K];
};

/**
 * Tipli diziden guvenli okuma.
 *
 * `noUncheckedIndexedAccess` her indeks okumasini `number | undefined` yapar.
 * Sistemler her zaman `slot < highWater <= capacity` araliginda okur, yani
 * `undefined` olusamaz; bu yardimci o degismezi tek bir yerde ifade eder.
 */
export function readI32(array: Int32Array | ReadonlyI32Array, index: number): number {
  const value = array[index];
  return value === undefined ? 0 : value;
}

/** Bayrak dizisinden guvenli okuma. */
export function readU8(array: Uint8Array | ReadonlyU8Array, index: number): number {
  const value = array[index];
  return value === undefined ? 0 : value;
}

/** Bos bir simulasyon durumu olusturur. */
export function createSimState(capacity: number = DEFAULT_CAPACITY): SimState {
  if (!Number.isInteger(capacity) || capacity <= 0 || capacity > MAX_SLOTS) {
    throw new RangeError(
      `createSimState: kapasite 1..${String(MAX_SLOTS)} araliginda tam sayi olmali, alinan ${String(capacity)}`,
    );
  }

  const state = {
    tick: 0,
    capacity,
    highWater: 0,
    entityCount: 0,
    freeSlots: new Int32Array(capacity),
    freeCount: 0,
  } as SimState;

  for (const field of I32_FIELDS) state[field] = new Int32Array(capacity);
  for (const field of U8_FIELDS) state[field] = new Uint8Array(capacity);
  return state;
}

/** Kapasiteyi en az `needed` olacak sekilde ikiye katlayarak buyutur. */
export function grow(state: SimState, needed: number): void {
  if (needed <= state.capacity) return;
  if (needed > MAX_SLOTS) {
    throw new RangeError(`Varlik siniri asildi: en fazla ${String(MAX_SLOTS)} slot.`);
  }

  let capacity = state.capacity;
  while (capacity < needed) capacity = capacity * 2;
  if (capacity > MAX_SLOTS) capacity = MAX_SLOTS;

  for (const field of I32_FIELDS) {
    const next = new Int32Array(capacity);
    next.set(state[field]);
    state[field] = next;
  }
  for (const field of U8_FIELDS) {
    const next = new Uint8Array(capacity);
    next.set(state[field]);
    state[field] = next;
  }
  const freeSlots = new Int32Array(capacity);
  freeSlots.set(state.freeSlots);
  state.freeSlots = freeSlots;
  state.capacity = capacity;
}

/** Bir varligin hala yasadigini ve taniticinin bayat olmadigini soyler. */
export function isAlive(state: SimState | ReadonlySimState, entity: Entity): boolean {
  if (entity === 0) return false;
  const slot = entitySlot(entity);
  if (slot >= state.highWater) return false;
  if (readU8(state.alive, slot) !== 1) return false;
  return readI32(state.generation, slot) === entityGeneration(entity);
}

/** Yeni bir varlik icin slot ayirir. Gerekirse kapasiteyi buyutur. */
function allocateSlot(state: SimState): number {
  if (state.freeCount > 0) {
    state.freeCount = state.freeCount - 1;
    return readI32(state.freeSlots, state.freeCount);
  }
  const slot = state.highWater;
  grow(state, slot + 1);
  state.highWater = slot + 1;
  state.generation[slot] = FIRST_GENERATION;
  return slot;
}

/** Yeni varligin baslangic degerleri. */
export interface SpawnParams {
  readonly unitType: number;
  readonly owner: number;
  readonly posX: number;
  readonly posY: number;
  readonly facing: number;
  readonly maxHealth: number;
}

/** Varlik yaratir ve taniticisini dondurur. */
export function spawn(state: SimState, params: SpawnParams): Entity {
  const slot = allocateSlot(state);

  state.alive[slot] = 1;
  state.moving[slot] = 0;
  state.unitType[slot] = params.unitType;
  state.owner[slot] = params.owner;
  state.posX[slot] = params.posX;
  state.posY[slot] = params.posY;
  state.facing[slot] = params.facing & 0xffff;
  state.velX[slot] = 0;
  state.velY[slot] = 0;
  state.targetX[slot] = params.posX;
  state.targetY[slot] = params.posY;
  state.health[slot] = params.maxHealth;
  state.maxHealth[slot] = params.maxHealth;
  state.entityCount = state.entityCount + 1;

  return makeEntity(slot, readI32(state.generation, slot));
}

/**
 * Slotu serbest birakir ve neslini arttirir. Sistemlerin ic kullanimi icindir;
 * disaridan `destroy` kullanilir.
 */
export function destroySlot(state: SimState, slot: number): void {
  if (readU8(state.alive, slot) !== 1) return;
  state.alive[slot] = 0;
  state.moving[slot] = 0;
  state.generation[slot] = nextGeneration(readI32(state.generation, slot));
  state.freeSlots[state.freeCount] = slot;
  state.freeCount = state.freeCount + 1;
  state.entityCount = state.entityCount - 1;
}

/**
 * Varligi yok eder.
 *
 * @returns Tanitici bayat veya varlik zaten olu ise `false`.
 */
export function destroy(state: SimState, entity: Entity): boolean {
  if (!isAlive(state, entity)) return false;
  destroySlot(state, entitySlot(entity));
  return true;
}

/** Bir slotun taniticisini uretir. Slot olu ise `NULL_ENTITY`. */
export function entityAt(state: SimState | ReadonlySimState, slot: number): Entity {
  if (readU8(state.alive, slot) !== 1) return 0 as Entity;
  return makeEntity(slot, readI32(state.generation, slot));
}
