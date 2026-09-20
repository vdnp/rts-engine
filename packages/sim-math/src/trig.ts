/**
 * Deterministik trigonometri.
 *
 * Acilar BAM16 (binary angle measurement) ile tutulur: tam tur = 65536 birim.
 * Bu secim sarmalamayi (`& 0xffff`) bedava yapar ve float'a hic ihtiyac duymaz.
 *
 * sin/cos ceyrek dalga tablosundan + dogrusal interpolasyonla, atan2 ise oran
 * tablosundan hesaplanir. libm cagrilmaz; tablolar codegen ile uretilir
 * (`scripts/gen-trig.mjs`).
 */
import { type Fx, Fx as F } from './fixed';
import { ATAN_TABLE, SIN_TABLE } from './trig.lut';

/** BAM16 aci. Tam tur = 65536. */
export type Angle = number & { readonly __angle: true };

const FULL = 65536;
const HALF = 32768;
const QUARTER = 16384;
const EIGHTH = 8192;

/** Ceyrek dalga tablosunda aci basina adim (16 BAM birimi = 1 tablo adimi). */
const SIN_SHIFT = 4;
const SIN_MASK = 15;

/** atan tablosunda oran basina adim (64 ham Fx birimi = 1 tablo adimi). */
const ATAN_SHIFT = 6;
const ATAN_MASK = 63;

function sinEntry(i: number): number {
  const v = SIN_TABLE[i];
  return v === undefined ? 0 : v;
}

function atanEntry(i: number): number {
  const v = ATAN_TABLE[i];
  return v === undefined ? 0 : v;
}

/** t: [0, 16384] araliginda ceyrek tur. Sonuc [0, 65536] ham Fx. */
function quarterSin(t: number): number {
  const i = t >> SIN_SHIFT;
  const f = t & SIN_MASK;
  const a = sinEntry(i);
  if (f === 0) return a;
  const b = sinEntry(i + 1);
  return a + (((b - a) * f) >> SIN_SHIFT);
}

/** ratio: [0, 65536] ham Fx (yani 0..1). Sonuc [0, 8192] BAM. */
function atanUnit(ratio: number): number {
  const i = ratio >> ATAN_SHIFT;
  const f = ratio & ATAN_MASK;
  const a = atanEntry(i);
  if (f === 0) return a;
  const b = atanEntry(i + 1);
  return a + (((b - a) * f) >> ATAN_SHIFT);
}

function sin(angle: Angle): Fx {
  const a = angle & 0xffff;
  const t = a & 0x3fff;
  switch (a >> 14) {
    case 0:
      return quarterSin(t) as Fx;
    case 1:
      return quarterSin(QUARTER - t) as Fx;
    case 2:
      // `| 0` negatif sifiri normale cevirir: -0 hash farki yaratir.
      return (-quarterSin(t) | 0) as Fx;
    default:
      return (-quarterSin(QUARTER - t) | 0) as Fx;
  }
}

function cos(angle: Angle): Fx {
  return sin(((angle + QUARTER) & 0xffff) as Angle);
}

/**
 * atan2(y, x) -> [0, 65536) BAM. Saat yonunun tersine, +x ekseninden olculur.
 * x ve y sifirsa 0 doner.
 */
function atan2(y: Fx, x: Fx): Angle {
  if (x === 0 && y === 0) return 0 as Angle;

  // Fx.MIN kendi negatifi oldugundan mutlak deger alirken kirpilir.
  let ax = x < 0 ? -(x as number) | 0 : x;
  let ay = y < 0 ? -(y as number) | 0 : y;
  if (ax < 0) ax = 2147483647;
  if (ay < 0) ay = 2147483647;

  let base: number;
  if (ay <= ax) {
    base = atanUnit(F.div(ay as Fx, ax as Fx));
  } else {
    base = QUARTER - atanUnit(F.div(ax as Fx, ay as Fx));
  }

  if (x >= 0) {
    return (y >= 0 ? base : (FULL - base) & 0xffff) as Angle;
  }
  return (y >= 0 ? HALF - base : HALF + base) as Angle;
}

/** Aciyi [0, 65536) araligina sarar. */
function normalize(angle: Angle): Angle {
  return (angle & 0xffff) as Angle;
}

/** Tur cinsinden double'dan aci uretir (1.0 = tam tur). Sadece sim sinirinda. */
function ofTurns(turns: number): Angle {
  return (((turns * FULL + (turns >= 0 ? 0.5 : -0.5)) | 0) & 0xffff) as Angle;
}

/** Dereceden aci uretir. Sadece sim sinirinda. */
function fromDegrees(degrees: number): Angle {
  return ofTurns(degrees / 360);
}

/** Aciyi dereceye cevirir. Sadece goruntuleme ve test icin. */
function toDegrees(angle: Angle): number {
  return ((angle & 0xffff) * 360) / FULL;
}

/** Aciyi radyana cevirir. Sadece goruntuleme ve test icin. */
function toRadians(angle: Angle): number {
  return ((angle & 0xffff) * 6.283185307179586) / FULL;
}

/** Ham int32 degerini Angle olarak etiketler. */
function raw(n: number): Angle {
  return ((n | 0) & 0xffff) as Angle;
}

/** BAM16 aci islemleri. */
export const Angle = {
  /** Tam tur. */
  FULL: FULL as Angle,
  /** Yarim tur (180 derece). */
  HALF: HALF as Angle,
  /** Ceyrek tur (90 derece). */
  QUARTER: QUARTER as Angle,
  /** Sekizde bir tur (45 derece). */
  EIGHTH: EIGHTH as Angle,

  raw,
  ofTurns,
  fromDegrees,
  toDegrees,
  toRadians,
  normalize,
  sin,
  cos,
  atan2,
} as const;
