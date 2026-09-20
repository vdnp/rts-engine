/**
 * @bfme/sim-math — deterministik sayisal temel.
 *
 * Bu paket `Math` yerine gecer. Icinde float aritmetik yalnizca sim sinirindaki
 * donusumlerde (`Fx.of`, `Fx.toFloat`, `Angle.fromDegrees`) kullanilir; hesap
 * yollarinin tamami tam sayidir.
 */
export { Fx, FX_BITS, FX_WRAP, imul32, isqrt } from './fixed';
export { Angle } from './trig';
export { Vec2 } from './vec2';
export { Rng } from './rng';
export type { RngState } from './rng';
