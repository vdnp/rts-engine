import { TICK_RATE } from '@bfme/core-sim';
import { describe, expect, it } from 'vitest';
import { TICK_MS, bamToRadians, interpolationAlpha, lerp, lerpAngle } from '../src/interpolate';

describe('TICK_MS', () => {
  it('sim tick hizindan turer', () => {
    expect(TICK_MS).toBeCloseTo(1000 / TICK_RATE, 10);
    expect(TICK_MS).toBeCloseTo(33.3333, 3);
  });
});

describe('interpolationAlpha', () => {
  it('tick basinda 0, sonunda 1', () => {
    expect(interpolationAlpha(0)).toBe(0);
    expect(interpolationAlpha(TICK_MS)).toBe(1);
  });

  it('ortada yarim verir', () => {
    expect(interpolationAlpha(TICK_MS / 2)).toBeCloseTo(0.5, 10);
  });

  it('dongu geri kalirsa ileri firlamaz', () => {
    expect(interpolationAlpha(TICK_MS * 5)).toBe(1);
    expect(interpolationAlpha(999999)).toBe(1);
  });

  it('negatif ve bozuk girdide 0 verir', () => {
    expect(interpolationAlpha(-10)).toBe(0);
    expect(interpolationAlpha(Number.NaN)).toBe(0);
    expect(interpolationAlpha(10, 0)).toBe(0);
    expect(interpolationAlpha(10, -1)).toBe(0);
  });

  it('ozel tick suresi kabul eder', () => {
    expect(interpolationAlpha(25, 100)).toBeCloseTo(0.25, 10);
  });
});

describe('lerp', () => {
  it('uclari tam verir', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('arada dogrusal', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(-10, 10, 0.25)).toBe(-5);
  });
});

describe('lerpAngle', () => {
  it('kisa yaydan gider, cemberi dolasmaz', () => {
    // 65000'den 500'e: 1036 birimlik kisa yol
    const mid = lerpAngle(65000, 500, 0.5);
    expect(mid).toBeCloseTo(65518, 6);
  });

  it('duz karisim olsaydi ters yone giderdi', () => {
    // Duz lerp 32750 verirdi (cemberin obur ucu); kisa yay vermiyor.
    expect(lerpAngle(65000, 500, 0.5)).not.toBeCloseTo(32750, 0);
  });

  it('uclari tam verir', () => {
    expect(lerpAngle(1000, 5000, 0)).toBe(1000);
    expect(lerpAngle(1000, 5000, 1)).toBe(5000);
  });

  it('sonuc her zaman [0, 65536) araliginda', () => {
    for (let from = 0; from < 65536; from += 977) {
      for (let to = 0; to < 65536; to += 1013) {
        for (const alpha of [0, 0.25, 0.5, 0.75, 1]) {
          const value = lerpAngle(from, to, alpha);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(65536);
        }
      }
    }
  });

  it('sifir cevresinde ileri ve geri simetrik', () => {
    // 65500 -> 36 arasi kisa yay 72 birim; tam ortasi sifirin kendisidir.
    expect(lerpAngle(65500, 36, 0.5)).toBe(0);
    const forward = lerpAngle(0, 1000, 0.5);
    const backward = lerpAngle(1000, 0, 0.5);
    expect(forward).toBeCloseTo(backward, 6);
  });
});

describe('bamToRadians', () => {
  it('ceyrek ve yarim turu dogru cevirir', () => {
    expect(bamToRadians(0)).toBe(0);
    expect(bamToRadians(16384)).toBeCloseTo(Math.PI / 2, 10);
    expect(bamToRadians(32768)).toBeCloseTo(Math.PI, 10);
    expect(bamToRadians(65536)).toBeCloseTo(Math.PI * 2, 10);
  });
});
