import { describe, expect, it } from 'vitest';
import { Rng } from '../src/rng';

/**
 * Bagimsiz PCG32 referansi: 64 bit aritmetik BigInt ile, uygulamanin hicbir
 * satirini paylasmadan. Uygulamadaki 32 bit yarim emulasyonunun dogrulugu
 * buna karsi olculur.
 */
const MASK64 = (1n << 64n) - 1n;
const MULT = 6364136223846793005n;

class ReferencePcg32 {
  private state = 0n;
  private readonly inc: bigint;

  constructor(seed: number, sequence: number) {
    this.inc = ((BigInt(sequence >>> 0) << 1n) | 1n) & MASK64;
    this.state = 0n;
    this.next();
    this.state = (this.state + BigInt(seed >>> 0)) & MASK64;
    this.next();
  }

  next(): number {
    const old = this.state;
    this.state = (old * MULT + this.inc) & MASK64;
    const xorshifted = Number((((old >> 18n) ^ old) >> 27n) & 0xffffffffn);
    const rot = Number(old >> 59n);
    return ((xorshifted >>> rot) | (xorshifted << ((32 - rot) & 31))) >>> 0;
  }
}

function fnv1a(values: readonly number[]): string {
  let h = 0x811c9dc5;
  for (const v of values) {
    for (let shift = 0; shift < 32; shift += 8) {
      h ^= (v >>> shift) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}

describe('Rng — PCG32 dogrulugu', () => {
  it.each([
    [42, 54],
    [0, 0],
    [1, 1],
    [0xffffffff, 0xffffffff],
    [123456789, 987654321],
  ])('seed=%i sequence=%i icin 10000 cikti BigInt referansiyla birebir ayni', (seed, seq) => {
    const rng = Rng.create(seed, seq);
    const ref = new ReferencePcg32(seed, seq);
    for (let i = 0; i < 10000; i++) {
      expect(rng.next()).toBe(ref.next());
    }
  });

  it('cikti her zaman uint32 araliginda', () => {
    const rng = Rng.create(7);
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(4294967295);
    }
  });
});

describe('Rng — determinizm', () => {
  it('ayni seed 10000 sayinin tamaminda ayni diziyi verir', () => {
    const a = Rng.create(42, 54);
    const b = Rng.create(42, 54);
    for (let i = 0; i < 10000; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('farkli seed farkli dizi verir', () => {
    const a = Rng.create(42);
    const b = Rng.create(43);
    let same = 0;
    for (let i = 0; i < 1000; i++) {
      if (a.next() === b.next()) same++;
    }
    expect(same).toBeLessThan(5);
  });

  it('farkli sequence ayni seed ile farkli akis verir', () => {
    const a = Rng.create(42, 1);
    const b = Rng.create(42, 2);
    let same = 0;
    for (let i = 0; i < 1000; i++) {
      if (a.next() === b.next()) same++;
    }
    expect(same).toBeLessThan(5);
  });
});

describe('Rng — serilestirme', () => {
  it('save/restore diziyi tam olarak kaldigi yerden surdurur', () => {
    const rng = Rng.create(99, 7);
    for (let i = 0; i < 137; i++) rng.next();

    const snapshot = rng.save();
    const expected = Array.from({ length: 500 }, () => rng.next());

    const restored = Rng.restore(snapshot);
    const actual = Array.from({ length: 500 }, () => restored.next());

    expect(actual).toEqual(expected);
  });

  it('save() dort uint32 alan dondurur', () => {
    const state = Rng.create(1, 2).save();
    for (const value of [state.stateHi, state.stateLo, state.incHi, state.incLo]) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(4294967295);
    }
  });

  it('save() sonraki cagrilardan etkilenmez (kopya dondurur)', () => {
    const rng = Rng.create(5);
    const snapshot = rng.save();
    const before = { ...snapshot };
    rng.next();
    expect(snapshot).toEqual(before);
  });
});

describe('Rng — turetilmis degerler', () => {
  it('nextInt sinirlar icinde kalir', () => {
    const rng = Rng.create(2024);
    for (const max of [1, 2, 3, 7, 100, 65536]) {
      for (let i = 0; i < 500; i++) {
        const v = rng.nextInt(max);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(max);
      }
    }
  });

  it('nextInt(1) her zaman 0 dondurur', () => {
    const rng = Rng.create(3);
    for (let i = 0; i < 100; i++) expect(rng.nextInt(1)).toBe(0);
  });

  it('nextInt kabaca duzgun dagilir', () => {
    const rng = Rng.create(777);
    const n = 80000;
    const counts = new Array<number>(8).fill(0);
    for (let i = 0; i < n; i++) {
      const idx = rng.nextInt(8);
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
    // Her kova beklenen paydan en fazla %10 sapmali.
    for (const c of counts) {
      expect(c).toBeGreaterThan(n / 8 - n / 80);
      expect(c).toBeLessThan(n / 8 + n / 80);
    }
  });

  it('nextInt gecersiz max degerinde hata firlatir', () => {
    const rng = Rng.create(1);
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-1)).toThrow(RangeError);
    expect(() => rng.nextInt(1.5)).toThrow(RangeError);
  });

  it('nextIntRange iki ucu da kapsar', () => {
    const rng = Rng.create(11);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(rng.nextIntRange(-3, 3));
    expect([...seen].sort((a, b) => a - b)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
    expect(() => rng.nextIntRange(5, 4)).toThrow(RangeError);
  });

  it('nextFx [0, 1) araliginda kalir', () => {
    const rng = Rng.create(31337);
    let min = 65536;
    let max = -1;
    for (let i = 0; i < 20000; i++) {
      const v = rng.nextFx();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(65536);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(min).toBeLessThan(200);
    expect(max).toBeGreaterThan(65336);
  });

  it('chance(1) her zaman true', () => {
    const rng = Rng.create(4);
    for (let i = 0; i < 50; i++) expect(rng.chance(1)).toBe(true);
  });
});

describe('Rng golden', () => {
  it('seed=42 sequence=54 ile ilk 10000 sayi degismedi', async () => {
    const rng = Rng.create(42, 54);
    const values = Array.from({ length: 10000 }, () => rng.next());
    const lines = [
      `count       ${values.length}`,
      `fnv1a       ${fnv1a(values)}`,
      `first16     ${values
        .slice(0, 16)
        .map((v) => v.toString(16).padStart(8, '0'))
        .join(' ')}`,
      `last4       ${values
        .slice(-4)
        .map((v) => v.toString(16).padStart(8, '0'))
        .join(' ')}`,
      '',
    ].join('\n');
    await expect(lines).toMatchFileSnapshot('./golden/rng-pcg32.txt');
  });
});
