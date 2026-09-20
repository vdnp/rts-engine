/**
 * Q16.16 2B vektor.
 *
 * Sicak dongulerde `core-sim` SoA dizileri kullanir; bu tip tekil hesaplar ve
 * komut verisi icindir. Degerler degismezdir, her islem yeni nesne dondurur.
 */
import { type Fx, Fx as F, isqrt } from './fixed';

export interface Vec2 {
  readonly x: Fx;
  readonly y: Fx;
}

const ZERO: Vec2 = { x: 0 as Fx, y: 0 as Fx };

function of(x: Fx, y: Fx): Vec2 {
  return { x, y };
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: F.add(a.x, b.x), y: F.add(a.y, b.y) };
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: F.sub(a.x, b.x), y: F.sub(a.y, b.y) };
}

function scale(v: Vec2, s: Fx): Vec2 {
  return { x: F.mul(v.x, s), y: F.mul(v.y, s) };
}

function neg(v: Vec2): Vec2 {
  return { x: F.neg(v.x), y: F.neg(v.y) };
}

/**
 * Uzunluk. Ham int32 bilesenler dogrudan karesi alinip toplanir, boylece
 * Q16.16 ara tasmasi olusmaz: |bilesen| < 1024 dunya birimi icin sonuc tamdir.
 * Daha buyuk degerlerde IEEE-754 yuvarlamasi devreye girer; sonuc hala
 * platformdan bagimsiz, yani deterministiktir.
 */
function length(v: Vec2): Fx {
  return isqrt(v.x * v.x + v.y * v.y) as Fx;
}

/** İki nokta arasindaki uzaklik. `length(sub(a, b))` ile ayni, ara nesne yok. */
function dist(a: Vec2, b: Vec2): Fx {
  const dx = (a.x - b.x) | 0;
  const dy = (a.y - b.y) | 0;
  return isqrt(dx * dx + dy * dy) as Fx;
}

/**
 * Uzakligin karesi. Karsilastirma icindir.
 * Q16.16'ya sigmayan sonuclar `Fx.MAX` degerine doyurulur (sarilmaz), boylece
 * "daha uzak" karsilastirmasi anlamini korur.
 */
function distSq(a: Vec2, b: Vec2): Fx {
  const dx = (a.x - b.x) | 0;
  const dy = (a.y - b.y) | 0;
  const raw = (dx * dx + dy * dy) / 65536;
  const floored = raw - (raw % 1);
  return (floored > 2147483647 ? 2147483647 : floored | 0) as Fx;
}

/** Uzunlugun karesi. `distSq` ile ayni doyurma kurali. */
function lengthSq(v: Vec2): Fx {
  return distSq(v, ZERO);
}

/**
 * Birim vektor. Sifir vektor icin sifir doner (bolme hatasi yerine).
 * Yuvarlama nedeniyle sonucun uzunlugu tam olarak 1.0 olmayabilir; sapma
 * en fazla birkac 2^-16 birimidir.
 */
function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len === 0) return ZERO;
  return { x: F.div(v.x, len), y: F.div(v.y, len) };
}

/** Q16.16 2B vektor islemleri. */
export const Vec2 = {
  ZERO,
  of,
  add,
  sub,
  scale,
  neg,
  length,
  lengthSq,
  dist,
  distSq,
  normalize,
} as const;
