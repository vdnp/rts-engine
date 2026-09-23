/**
 * Sim ile ekran arasindaki zaman koprusu.
 *
 * Sim sabit 30 Hz ile koşar, ekran ise kendi hizinda. Iki tick arasinda kalan
 * sure `alpha` olarak ifade edilir ve gorsel konumlar N-1 ile N arasinda
 * karistirilir. Duvar saati birimi BURADA baslar: `core-sim` yalnizca
 * `TICK_RATE` bilir, milisaniyeyi bilmez.
 */
import { TICK_RATE, shortestTurn } from '@bfme/core-sim';

/** Bir tick'in milisaniye karsiligi. */
export const TICK_MS = 1000 / TICK_RATE;

/** Tam tur, BAM16 birimi. */
const FULL_TURN = 65536;

const TWO_PI = Math.PI * 2;

/**
 * Birikmis sureden interpolasyon carpani uretir.
 *
 * Sonuc [0, 1] araligina kirpilir: dongu geri kalirsa (akumulator bir
 * tick'ten buyukse) gorsel ileri firlamaz, yalnizca en son tick'te durur.
 *
 * @param accumulatorMs Son tick'ten bu yana birikmis sure, milisaniye.
 */
export function interpolationAlpha(accumulatorMs: number, tickMs: number = TICK_MS): number {
  if (!(tickMs > 0)) return 0;
  const alpha = accumulatorMs / tickMs;
  if (!(alpha > 0)) return 0;
  return alpha > 1 ? 1 : alpha;
}

/** Dogrusal karisim. */
export function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

/**
 * Aci karisimi, BAM16 uzayinda en kisa yaydan.
 *
 * Duz `lerp` 65000'den 500'e giderken butun cemberi geri dolasirdi; bu
 * fonksiyon 1036 birimlik kisa yolu secer.
 *
 * @returns BAM16 aci, [0, 65536) araliginda.
 */
export function lerpAngle(from: number, to: number, alpha: number): number {
  const blended = from + shortestTurn(from, to) * alpha;
  const wrapped = blended % FULL_TURN;
  return wrapped < 0 ? wrapped + FULL_TURN : wrapped;
}

/** BAM16 aciyi radyana cevirir. */
export function bamToRadians(bam: number): number {
  return (bam / FULL_TURN) * TWO_PI;
}
