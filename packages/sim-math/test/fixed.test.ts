import { describe, expect, it } from 'vitest';
import { Fx, imul32, isqrt } from '../src/fixed';

/**
 * Bagimsiz referans: BigInt ile tam 64 bit hesap, sonra int32'ye sarma.
 * Uygulamanin tek satirini bile paylasmaz.
 */
const I32 = (v: bigint): number => Number(BigInt.asIntN(32, v));

function refMul(a: number, b: number): number {
  return I32((BigInt(a) * BigInt(b)) >> 16n);
}

function refDiv(a: number, b: number): number {
  const n = BigInt(a) << 16n;
  const d = BigInt(b);
  // BigInt bolmesi sifira dogru kirpar; floor'a cevir.
  let q = n / d;
  if (n % d !== 0n && n < 0n !== d < 0n) q -= 1n;
  return I32(q);
}

/** Testlere ozgu, uygulamadan bagimsiz basit LCG (fuzz orneklemesi icin). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

const SAMPLES = 20000;

describe('Fx donusumler', () => {
  it('of/toFloat gidis donus yapar', () => {
    for (const v of [0, 1, -1, 0.5, -0.5, 1.25, -1.25, 32767, -32768, 0.00001526]) {
      expect(Fx.toFloat(Fx.of(v))).toBeCloseTo(v, 4);
    }
  });

  it('of sifirdan uzaga yuvarlar', () => {
    expect(Fx.of(1 / 65536 / 2)).toBe(1);
    expect(Fx.of(-1 / 65536 / 2)).toBe(-1);
  });

  it('fromInt/toInt eksi sonsuza dogru yuvarlar', () => {
    expect(Fx.toInt(Fx.fromInt(7))).toBe(7);
    expect(Fx.toInt(Fx.of(1.75))).toBe(1);
    expect(Fx.toInt(Fx.of(-1.75))).toBe(-2);
    expect(Fx.floor(Fx.of(-1.75))).toBe(Fx.of(-2));
  });

  it('sabitler dogru', () => {
    expect(Fx.ONE).toBe(65536);
    expect(Fx.toFloat(Fx.HALF)).toBe(0.5);
    expect(Fx.MAX).toBe(2147483647);
    expect(Fx.MIN).toBe(-2147483648);
  });
});

describe('Fx toplama ve cikarma', () => {
  it('temel islemler', () => {
    expect(Fx.add(Fx.of(1.5), Fx.of(2.25))).toBe(Fx.of(3.75));
    expect(Fx.sub(Fx.of(1.5), Fx.of(2.25))).toBe(Fx.of(-0.75));
  });

  it('tasmada int32 sarmasi yapar', () => {
    expect(Fx.add(Fx.MAX, Fx.ONE)).toBe(Fx.MIN + 65535);
    expect(Fx.add(Fx.MAX, Fx.raw(1))).toBe(Fx.MIN);
    expect(Fx.sub(Fx.MIN, Fx.raw(1))).toBe(Fx.MAX);
  });
});

describe('Fx carpma', () => {
  it('bilinen degerler', () => {
    expect(Fx.mul(Fx.of(2), Fx.of(3))).toBe(Fx.of(6));
    expect(Fx.mul(Fx.of(-2), Fx.of(3))).toBe(Fx.of(-6));
    expect(Fx.mul(Fx.of(0.5), Fx.of(0.5))).toBe(Fx.of(0.25));
    expect(Fx.mul(Fx.ONE, Fx.of(-7.5))).toBe(Fx.of(-7.5));
  });

  it('eksi sonsuza dogru yuvarlar', () => {
    // 1/65536 * 1/65536 = 2^-32, floor -> 0
    expect(Fx.mul(Fx.raw(1), Fx.raw(1))).toBe(0);
    // -1/65536 * 1/65536 -> floor(-2^-32 * 2^16) = -1
    expect(Fx.mul(Fx.raw(-1), Fx.raw(1))).toBe(-1);
  });

  it('tasma sinirlarinda BigInt referansiyla birebir ayni', () => {
    const edges = [
      Fx.MAX,
      Fx.MIN,
      Fx.raw(Fx.MAX - 1),
      Fx.raw(Fx.MIN + 1),
      Fx.ONE,
      Fx.raw(-65536),
      Fx.raw(0),
      Fx.raw(1),
      Fx.raw(-1),
      Fx.raw(65535),
      Fx.raw(-65535),
      Fx.raw(0x7fff0000),
      Fx.raw(-0x7fff0000),
    ];
    for (const a of edges) {
      for (const b of edges) {
        expect(Fx.mul(a, b)).toBe(refMul(a, b));
      }
    }
  });

  it(`${SAMPLES} rastgele girdide BigInt referansiyla birebir ayni`, () => {
    const rnd = lcg(0xc0ffee);
    for (let i = 0; i < SAMPLES; i++) {
      const a = Fx.raw(rnd() | 0);
      const b = Fx.raw(rnd() | 0);
      expect(Fx.mul(a, b)).toBe(refMul(a, b));
    }
  });
});

describe('Fx bolme', () => {
  it('bilinen degerler', () => {
    expect(Fx.div(Fx.of(6), Fx.of(3))).toBe(Fx.of(2));
    expect(Fx.div(Fx.of(1), Fx.of(4))).toBe(Fx.of(0.25));
    expect(Fx.div(Fx.of(-6), Fx.of(3))).toBe(Fx.of(-2));
  });

  it('sifira bolmede hata firlatir', () => {
    expect(() => Fx.div(Fx.ONE, Fx.raw(0))).toThrow(RangeError);
  });

  it(`${SAMPLES} rastgele girdide BigInt referansiyla birebir ayni`, () => {
    const rnd = lcg(0xbadf00d);
    for (let i = 0; i < SAMPLES; i++) {
      const a = Fx.raw(rnd() | 0);
      const b = Fx.raw(rnd() | 0);
      if (b === 0) continue;
      expect(Fx.div(a, b)).toBe(refDiv(a, b));
    }
  });
});

describe('Fx karekok', () => {
  it('tam kareler', () => {
    expect(Fx.sqrt(Fx.of(4))).toBe(Fx.of(2));
    expect(Fx.sqrt(Fx.of(9))).toBe(Fx.of(3));
    expect(Fx.sqrt(Fx.of(1))).toBe(Fx.of(1));
    expect(Fx.sqrt(Fx.of(0))).toBe(0);
  });

  it('libm referansina 1 ham birim icinde yakin', () => {
    const rnd = lcg(0x5eed);
    for (let i = 0; i < 5000; i++) {
      const a = Fx.raw((rnd() >>> 1) | 0);
      const got = Fx.sqrt(a);
      const want = Math.sqrt(a / 65536) * 65536;
      expect(Math.abs(got - want)).toBeLessThanOrEqual(1);
    }
  });

  it('negatif girdide hata firlatir', () => {
    expect(() => Fx.sqrt(Fx.raw(-1))).toThrow(RangeError);
  });

  it('isqrt tam sayi karekoku dondurur', () => {
    expect(isqrt(0)).toBe(0);
    expect(isqrt(1)).toBe(1);
    expect(isqrt(3)).toBe(1);
    expect(isqrt(4)).toBe(2);
    expect(isqrt(8)).toBe(2);
    expect(isqrt(9)).toBe(3);
    expect(isqrt(2 ** 46)).toBe(2 ** 23);
    expect(isqrt(2 ** 46 - 1)).toBe(2 ** 23 - 1);
  });
});

describe('Fx yardimcilar', () => {
  it('abs, neg, min, max, clamp', () => {
    expect(Fx.abs(Fx.of(-3))).toBe(Fx.of(3));
    expect(Fx.neg(Fx.of(3))).toBe(Fx.of(-3));
    expect(Fx.min(Fx.of(1), Fx.of(2))).toBe(Fx.of(1));
    expect(Fx.max(Fx.of(1), Fx.of(2))).toBe(Fx.of(2));
    expect(Fx.clamp(Fx.of(5), Fx.of(0), Fx.of(3))).toBe(Fx.of(3));
    expect(Fx.clamp(Fx.of(-5), Fx.of(0), Fx.of(3))).toBe(Fx.of(0));
    expect(Fx.clamp(Fx.of(2), Fx.of(0), Fx.of(3))).toBe(Fx.of(2));
  });

  it('Fx.MIN kendi negatifidir (int32 asimetrisi, tanimli davranis)', () => {
    expect(Fx.abs(Fx.MIN)).toBe(Fx.MIN);
    expect(Fx.neg(Fx.MIN)).toBe(Fx.MIN);
  });
});

describe('imul32', () => {
  it('BigInt referansiyla birebir ayni', () => {
    const rnd = lcg(0x1234);
    for (let i = 0; i < SAMPLES; i++) {
      const a = rnd() | 0;
      const b = rnd() | 0;
      expect(imul32(a, b)).toBe(I32(BigInt(a) * BigInt(b)));
    }
  });
});
