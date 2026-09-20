/**
 * Durum hash'i — determinizm dogrulamasinin capasi.
 *
 * FNV-1a 32 bit. Gelecekteki tick'leri etkileyebilecek HER SEY hash'e girer:
 * tick sayaci, yasayan varliklarin tum bilesenleri, serbest slot yigini ve
 * `highWater`. Serbest yigin da girer, cunku bir sonraki `spawn`in hangi slotu
 * alacagini o belirler.
 *
 * Yeni bir bilesen alani eklendiginde `I32_FIELDS` / `U8_FIELDS` guncellenir
 * ve hash onu kendiliginden kapsar; boylece hash asla kor kalmaz.
 */
import { I32_FIELDS, type ReadonlySimState, U8_FIELDS, readI32, readU8 } from './state';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function mixByte(hash: number, byte: number): number {
  const x = (hash ^ byte) >>> 0;
  // (x * FNV_PRIME) mod 2^32, Math kullanmadan: x = hi*2^16 + lo.
  const lo = x & 0xffff;
  const hi = x >>> 16;
  return (((hi * FNV_PRIME) << 16) + lo * FNV_PRIME) >>> 0;
}

/** Bir int32'yi dort bayt olarak hash'e karistirir (little-endian). */
function mixI32(hash: number, value: number): number {
  let h = hash;
  h = mixByte(h, value & 0xff);
  h = mixByte(h, (value >>> 8) & 0xff);
  h = mixByte(h, (value >>> 16) & 0xff);
  h = mixByte(h, (value >>> 24) & 0xff);
  return h;
}

/** Durumun deterministik hash'i. Ayni durum her zaman ayni sayiyi verir. */
export function hashState(state: ReadonlySimState): number {
  let h = FNV_OFFSET;
  h = mixI32(h, state.tick);
  h = mixI32(h, state.highWater);
  h = mixI32(h, state.entityCount);
  h = mixI32(h, state.freeCount);

  for (let i = 0; i < state.freeCount; i++) {
    h = mixI32(h, readI32(state.freeSlots, i));
  }

  for (let slot = 0; slot < state.highWater; slot++) {
    const alive = readU8(state.alive, slot);
    h = mixI32(h, slot);
    h = mixI32(h, alive);
    h = mixI32(h, readI32(state.generation, slot));
    if (alive !== 1) continue;

    for (const field of I32_FIELDS) {
      h = mixI32(h, readI32(state[field], slot));
    }
    for (const field of U8_FIELDS) {
      h = mixI32(h, readU8(state[field], slot));
    }
  }

  return h >>> 0;
}

/** Hash'i sekiz haneli onaltilik metne cevirir. */
export function formatStateHash(hash: number): string {
  return (hash >>> 0).toString(16).padStart(8, '0');
}
