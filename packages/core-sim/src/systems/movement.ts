/**
 * Hareket sistemi.
 *
 * Hedefi olan her varlik, bir tick'te kat edebilecegi mesafe kadar hedefe
 * dogru ilerler ve yonunu birim tipinin donus hizi kadar cevirir. Hedefe
 * kalan mesafe bir tick'lik adimdan kucukse tam hedefe oturur ve durur.
 *
 * Tum hesap tam sayidir: uzunluk ham int32 kareler uzerinden `isqrt` ile,
 * bolmeler `Fx.div` / `idiv` ile yapilir. `/` operatoru bu pakette yasaktir.
 */
import type { Content } from '@bfme/schema';
import { Angle, type Fx, Fx as F, idiv, isqrt } from '@bfme/sim-math';
import { TICK_RATE } from '../constants';
import { type SimState, readI32, readU8 } from '../state';

const FULL_TURN = 65536;
const HALF_TURN = 32768;

/**
 * İki BAM acisi arasindaki en kisa isaretli fark, [-32768, 32768) araliginda.
 */
export function shortestTurn(from: number, to: number): number {
  const delta = (to - from) & 0xffff;
  return delta >= HALF_TURN ? delta - FULL_TURN : delta;
}

/** `current`'i `desired`'a dogru en fazla `maxStep` kadar cevirir. */
export function turnToward(current: number, desired: number, maxStep: number): number {
  const delta = shortestTurn(current, desired);
  const step = delta > maxStep ? maxStep : delta < -maxStep ? -maxStep : delta;
  return (current + step) & 0xffff;
}

export function movementSystem(state: SimState, content: Content): void {
  for (let slot = 0; slot < state.highWater; slot++) {
    if (readU8(state.alive, slot) !== 1) continue;
    if (readU8(state.moving, slot) !== 1) continue;

    const type = content.unitTypes[readI32(state.unitType, slot)];
    if (type === undefined) {
      // Tanimsiz birim tipi: hareketi durdur, ama varligi yok etme.
      state.moving[slot] = 0;
      state.velX[slot] = 0;
      state.velY[slot] = 0;
      continue;
    }

    const posX = readI32(state.posX, slot);
    const posY = readI32(state.posY, slot);
    const targetX = readI32(state.targetX, slot);
    const targetY = readI32(state.targetY, slot);

    const dx = (targetX - posX) | 0;
    const dy = (targetY - posY) | 0;
    const distance = isqrt(dx * dx + dy * dy);
    const step = idiv(type.speed, TICK_RATE);

    if (distance <= step || step <= 0) {
      state.posX[slot] = targetX;
      state.posY[slot] = targetY;
      state.velX[slot] = 0;
      state.velY[slot] = 0;
      state.moving[slot] = 0;
    } else {
      // Once carp, sonra bol: tek bir yuvarlama noktasi, daha az kayip.
      // Fx.div eksi sonsuza yuvarladigindan adim basina en fazla 1 ham birim
      // (1/65536 dunya birimi) kaybedilir; birikimi hedefe tam oturma kapatir.
      const velX = F.div(F.mul(dx as Fx, step as Fx), distance as Fx);
      const velY = F.div(F.mul(dy as Fx, step as Fx), distance as Fx);
      state.velX[slot] = velX;
      state.velY[slot] = velY;
      state.posX[slot] = (posX + velX) | 0;
      state.posY[slot] = (posY + velY) | 0;
    }

    if (dx !== 0 || dy !== 0) {
      const desired = Angle.atan2(dy as Fx, dx as Fx);
      const maxStep = idiv(type.turnRate, TICK_RATE);
      state.facing[slot] = turnToward(readI32(state.facing, slot), desired, maxStep);
    }
  }
}
