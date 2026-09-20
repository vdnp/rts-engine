import { describe, expect, it } from 'vitest';
import { Fx } from '../src/fixed';
import { Vec2 } from '../src/vec2';

const v = (x: number, y: number): Vec2 => Vec2.of(Fx.of(x), Fx.of(y));

describe('Vec2 temel islemler', () => {
  it('add / sub / scale / neg', () => {
    expect(Vec2.add(v(1, 2), v(3, 4))).toEqual(v(4, 6));
    expect(Vec2.sub(v(1, 2), v(3, 4))).toEqual(v(-2, -2));
    expect(Vec2.scale(v(1.5, -2), Fx.of(2))).toEqual(v(3, -4));
    expect(Vec2.neg(v(1, -2))).toEqual(v(-1, 2));
  });

  it('ZERO degismez ve sifirdir', () => {
    expect(Vec2.ZERO).toEqual(v(0, 0));
  });
});

describe('Vec2 uzunluk', () => {
  it('3-4-5 ucgeni tam sonuc verir', () => {
    expect(Vec2.length(v(3, 4))).toBe(Fx.of(5));
    expect(Vec2.dist(v(1, 1), v(4, 5))).toBe(Fx.of(5));
  });

  it('eksen uzerinde uzunluk bilesenine esit', () => {
    expect(Vec2.length(v(7, 0))).toBe(Fx.of(7));
    expect(Vec2.length(v(0, -7))).toBe(Fx.of(7));
    expect(Vec2.length(Vec2.ZERO)).toBe(0);
  });

  it('libm referansindan en fazla 1 ham birim sapar (|bilesen| < 1024)', () => {
    let worst = 0;
    for (let i = 0; i < 2000; i++) {
      const x = ((i * 37) % 2047) - 1023;
      const y = ((i * 91) % 2047) - 1023;
      const got = Vec2.length(v(x, y));
      const want = Math.hypot(x, y) * 65536;
      worst = Math.max(worst, Math.abs(got - want));
    }
    expect(worst).toBeLessThanOrEqual(1);
  });

  it('dist(a,b) === length(sub(a,b))', () => {
    for (let i = 0; i < 500; i++) {
      const a = v(i % 97, (i * 3) % 61);
      const b = v((i * 7) % 53, i % 29);
      expect(Vec2.dist(a, b)).toBe(Vec2.length(Vec2.sub(a, b)));
    }
  });
});

describe('Vec2 uzunluk karesi', () => {
  it('kucuk degerlerde tam sonuc', () => {
    expect(Vec2.lengthSq(v(3, 4))).toBe(Fx.of(25));
    expect(Vec2.distSq(v(0, 0), v(3, 4))).toBe(Fx.of(25));
  });

  it('Q16.16 disina tasan sonuclari Fx.MAX degerine doyurur', () => {
    // 200^2 + 200^2 = 80000 > 32767, sarilmaz, doyurulur.
    expect(Vec2.lengthSq(v(200, 200))).toBe(Fx.MAX);
    expect(Vec2.lengthSq(v(128, 128))).toBe(Fx.MAX);
    // Tam sinirin altinda hala gercek deger.
    expect(Vec2.lengthSq(v(100, 100))).toBe(Fx.of(20000));
  });

  it('karsilastirma icin monotondur', () => {
    let prev = -1;
    for (let d = 0; d < 180; d += 1) {
      const cur = Vec2.lengthSq(v(d, 0));
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe('Vec2 normalize', () => {
  it('sifir vektor sifir doner (bolme hatasi degil)', () => {
    expect(Vec2.normalize(Vec2.ZERO)).toEqual(Vec2.ZERO);
  });

  it('birim uzunluga yakinsar', () => {
    for (let i = 1; i < 400; i++) {
      const n = Vec2.normalize(v(i % 131, (i * 5) % 173));
      const len = Vec2.length(n);
      expect(Math.abs(len - 65536)).toBeLessThanOrEqual(3);
    }
  });

  it('yonu korur', () => {
    const n = Vec2.normalize(v(3, 4));
    expect(Fx.toFloat(n.x)).toBeCloseTo(0.6, 3);
    expect(Fx.toFloat(n.y)).toBeCloseTo(0.8, 3);
  });

  it('eksen vektorlerini tam birime cevirir', () => {
    expect(Vec2.normalize(v(5, 0))).toEqual(v(1, 0));
    expect(Vec2.normalize(v(0, -5))).toEqual(v(0, -1));
  });
});
