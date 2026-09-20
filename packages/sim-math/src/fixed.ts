/**
 * Q16.16 fixed-point aritmetik.
 *
 * Tum degerler int32 olarak tutulur: 16 bit tam kisim (isaretli), 16 bit kesir.
 * Temsil edilebilir aralik [-32768, 32767.999984741].
 *
 * Tasma davranisi TANIMLIDIR: her islem sonucu int32'ye sarilir (`| 0`, yani
 * ECMAScript ToInt32 semantigi — once sifira dogru kirpilir, sonra 2^32 modu
 * alinir). Bu davranis platformdan bagimsizdir, dolayisiyla deterministiktir.
 *
 * Yuvarlama: `mul` ve `div` eksi sonsuza dogru yuvarlar (floor). Bu secim her iki
 * fonksiyonda da aynidir; isaret degisiminde asimetri yoktur.
 */

/** Q16.16 fixed-point sayi. Duz `number` ile karistirilamaz. */
export type Fx = number & { readonly __fx: true };

/** Kesir bitlerinin sayisi. */
export const FX_BITS = 16;

/** 1.0'in ham degeri. */
const ONE_RAW = 65536;

/** 2^32, tasma kontrolu icin. */
const TWO_POW_32 = 4294967296;

/**
 * Bir double'i eksi sonsuza dogru yuvarlar. `Math.floor` yasak oldugu icin
 * kesir kismi `%` ile alinir; `%` (fmod) IEEE-754'te tam sonuclu ve
 * deterministiktir.
 */
function floorDouble(v: number): number {
  const frac = v % 1;
  if (frac === 0) return v;
  return v < 0 ? v - frac - 1 : v - frac;
}

/**
 * Negatif olmayan bir tam sayinin tam sayi karekokunu dondurur (floor).
 * Newton yontemi; tum ara degerler tam sayidir, dolayisiyla deterministiktir.
 * n <= 2^47 icin tam sonucludur.
 */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  if (n < 4) return 1;
  // Baslangic tahmini: sqrt(n) <= x olacak sekilde en kucuk 2 kuvveti.
  let x = 1;
  while (x * x < n) x *= 2;
  for (;;) {
    const next = floorDouble((x + floorDouble(n / x)) / 2);
    if (next >= x) return x;
    x = next;
  }
}

/**
 * Tam sayi bolmesi, eksi sonsuza dogru yuvarlanmis (floor).
 *
 * `core-sim` icinde `/` operatoru yasaktir (float uretir); tam sayi bolmesi
 * gerektiginde bu kullanilir. |a| <= 2^47 icin tam sonucludur.
 *
 * @throws {RangeError} b sifirsa.
 */
export function idiv(a: number, b: number): number {
  if (b === 0) {
    throw new RangeError('idiv: sifira bolme');
  }
  return floorDouble(a / b);
}

/** 32 bit tam sayi carpimi (Math.imul esdegeri, tam sonuclu). */
export function imul32(a: number, b: number): number {
  const aLo = a & 0xffff;
  const aHi = a >>> 16;
  const bLo = b & 0xffff;
  const bHi = b >>> 16;
  return (((aHi * bLo + aLo * bHi) << 16) + aLo * bLo) | 0;
}

function add(a: Fx, b: Fx): Fx {
  return ((a + b) | 0) as Fx;
}

function sub(a: Fx, b: Fx): Fx {
  return ((a - b) | 0) as Fx;
}

/**
 * Tam sonuclu Q16.16 carpim: floor(a * b / 2^16), int32'ye sarilir.
 *
 * a ve b 16 bitlik yarimlara ayrilir; boylece 64 bitlik ara sonuc double'in
 * 53 bitlik mantisine sigacak parcalara bolunur ve hicbir bit kaybolmaz.
 */
function mul(a: Fx, b: Fx): Fx {
  const aHi = a >> 16;
  const aLo = a & 0xffff;
  const bHi = b >> 16;
  const bLo = b & 0xffff;
  const high = (imul32(aHi, bHi) << 16) | 0;
  return ((high + aHi * bLo + aLo * bHi + ((aLo * bLo) >>> 16)) | 0) as Fx;
}

/**
 * Q16.16 bolme: floor(a * 2^16 / b), int32'ye sarilir.
 *
 * a * 2^16 en fazla 2^47'dir, yani double'da tam temsil edilir. IEEE-754 bolme
 * dogru yuvarlanmistir ve bu aralikta floor sonucu tam dogrudur.
 *
 * @throws {RangeError} b sifirsa. Bu bir tasma degil, programlama hatasidir.
 */
function div(a: Fx, b: Fx): Fx {
  if (b === 0) {
    throw new RangeError('Fx.div: sifira bolme');
  }
  return (floorDouble((a * ONE_RAW) / b) | 0) as Fx;
}

function neg(a: Fx): Fx {
  return (-(a as number) | 0) as Fx;
}

/** Mutlak deger. Fx.MIN kendi negatifidir (int32 asimetrisi); bu deger sarilir. */
function abs(a: Fx): Fx {
  return (a < 0 ? -(a as number) | 0 : a) as Fx;
}

/**
 * Karekok. Sonuc floor'lanir.
 *
 * @throws {RangeError} a negatifse.
 */
function sqrt(a: Fx): Fx {
  if (a < 0) {
    throw new RangeError('Fx.sqrt: negatif giris');
  }
  return (isqrt(a * ONE_RAW) | 0) as Fx;
}

function min(a: Fx, b: Fx): Fx {
  return a < b ? a : b;
}

function max(a: Fx, b: Fx): Fx {
  return a > b ? a : b;
}

function clamp(v: Fx, lo: Fx, hi: Fx): Fx {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Kesir kismini atarak eksi sonsuza dogru yuvarlar; sonuc yine Fx'tir. */
function floor(a: Fx): Fx {
  return ((a & ~0xffff) | 0) as Fx;
}

/** Tam sayi kismini dondurur (eksi sonsuza dogru). */
function toInt(a: Fx): number {
  return a >> 16;
}

/** Tam sayidan Fx uretir. |n| > 32767 ise sarilir. */
function fromInt(n: number): Fx {
  return ((n << 16) | 0) as Fx;
}

/**
 * Double'dan Fx uretir. Yuvarlama sifirdan uzaga (round-half-away-from-zero).
 * Bu, sim sinirindaki tek float donusum noktasidir.
 */
function of(n: number): Fx {
  return ((n * ONE_RAW + (n >= 0 ? 0.5 : -0.5)) | 0) as Fx;
}

/** Fx'i double'a cevirir. Sadece goruntuleme ve test icin. */
function toFloat(a: Fx): number {
  return a / ONE_RAW;
}

/** Ham int32 degerini Fx olarak etiketler. Tablo ve serilestirme icin. */
function raw(n: number): Fx {
  return (n | 0) as Fx;
}

/**
 * Q16.16 islemleri. `Math` yerine bu kullanilir.
 *
 * Kullanim: `Fx.mul(a, b)`, `Fx.of(1.5)`, `Fx.ONE`.
 */
export const Fx = {
  /** 0.0 */
  ZERO: 0 as Fx,
  /** 1.0 */
  ONE: ONE_RAW as Fx,
  /** 0.5 */
  HALF: 32768 as Fx,
  /** Temsil edilebilir en buyuk deger (~32767.99998). */
  MAX: 2147483647 as Fx,
  /** Temsil edilebilir en kucuk deger (-32768). */
  MIN: -2147483648 as Fx,
  /** En kucuk pozitif adim (2^-16). */
  EPSILON: 1 as Fx,

  of,
  raw,
  fromInt,
  toInt,
  toFloat,
  add,
  sub,
  mul,
  div,
  neg,
  abs,
  sqrt,
  min,
  max,
  clamp,
  floor,
} as const;

/** 2^32; tasma testlerinin sinir degerlerini tarif etmek icin disari verilir. */
export const FX_WRAP = TWO_POW_32;
