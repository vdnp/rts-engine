import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_TICKS_PER_FRAME, FixedTimestep } from '../src/loop';

const TICK = 1000 / 30;

function counting() {
  let count = 0;
  return {
    step: () => {
      count = count + 1;
    },
    get count() {
      return count;
    },
  };
}

describe('FixedTimestep — kurulus', () => {
  it('gecersiz tick suresini reddeder', () => {
    expect(() => new FixedTimestep(0)).toThrow(RangeError);
    expect(() => new FixedTimestep(-1)).toThrow(RangeError);
    expect(() => new FixedTimestep(Number.NaN)).toThrow(RangeError);
  });

  it('gecersiz tick sinirini reddeder', () => {
    expect(() => new FixedTimestep(TICK, 0)).toThrow(RangeError);
    expect(() => new FixedTimestep(TICK, 1.5)).toThrow(RangeError);
  });
});

describe('FixedTimestep — adimlama', () => {
  it('bir tick dolmadan adim atmaz', () => {
    const loop = new FixedTimestep(TICK);
    const counter = counting();
    expect(loop.advance(TICK / 2, counter.step)).toBe(0);
    expect(counter.count).toBe(0);
  });

  it('tam bir tick tek adim atar', () => {
    const loop = new FixedTimestep(TICK);
    const counter = counting();
    expect(loop.advance(TICK, counter.step)).toBe(1);
    expect(counter.count).toBe(1);
  });

  it('artan sureyi bir sonraki kareye tasir', () => {
    const loop = new FixedTimestep(TICK);
    const counter = counting();
    loop.advance(TICK * 0.6, counter.step);
    loop.advance(TICK * 0.6, counter.step);
    expect(counter.count).toBe(1);
    expect(loop.accumulator).toBeCloseTo(TICK * 0.2, 6);
  });

  it('bir karede birden cok tick atabilir', () => {
    const loop = new FixedTimestep(TICK);
    const counter = counting();
    expect(loop.advance(TICK * 3, counter.step)).toBe(3);
  });

  it('uzun bir duraklamadan sonra kilitlenmez', () => {
    const loop = new FixedTimestep(TICK, 5);
    const counter = counting();
    // sekme 10 saniye arka planda kaldi
    expect(loop.advance(10000, counter.step)).toBe(5);
    expect(counter.count).toBe(5);
    // biriken fazla ATILIR, sonraki karede patlamaz
    expect(loop.advance(TICK, counter.step)).toBe(1);
  });

  it('negatif ve bozuk sureyi sifir sayar', () => {
    const loop = new FixedTimestep(TICK);
    const counter = counting();
    expect(loop.advance(-100, counter.step)).toBe(0);
    expect(loop.advance(Number.NaN, counter.step)).toBe(0);
    expect(loop.accumulator).toBe(0);
  });

  it('sabit hizda uzun surede dogru sayida tick atar', () => {
    const loop = new FixedTimestep(TICK);
    const counter = counting();
    // 60 Hz ekranda 10 saniye -> 300 tick
    for (let frame = 0; frame < 600; frame++) loop.advance(1000 / 60, counter.step);
    expect(counter.count).toBe(300);
  });

  it('degisken kare suresinde de dogru sayida tick atar', () => {
    const loop = new FixedTimestep(TICK);
    const counter = counting();
    const deltas = [8, 33, 12, 50, 4, 21, 17, 9];
    let total = 0;
    for (let i = 0; i < 400; i++) {
      const delta = deltas[i % deltas.length] ?? 16;
      total = total + delta;
      loop.advance(delta, counter.step);
    }
    expect(counter.count).toBe(Math.floor(total / TICK));
  });
});

describe('FixedTimestep — alpha', () => {
  it('her zaman [0, 1) araliginda', () => {
    const loop = new FixedTimestep(TICK);
    const counter = counting();
    for (const delta of [0, 1, 5, 16.6, 33.3, 40, 100, 1000]) {
      loop.advance(delta, counter.step);
      expect(loop.alpha).toBeGreaterThanOrEqual(0);
      expect(loop.alpha).toBeLessThan(1);
    }
  });

  it('tick icindeki ilerlemeyi yansitir', () => {
    const loop = new FixedTimestep(TICK);
    const counter = counting();
    loop.advance(TICK / 4, counter.step);
    expect(loop.alpha).toBeCloseTo(0.25, 6);
    loop.advance(TICK / 4, counter.step);
    expect(loop.alpha).toBeCloseTo(0.5, 6);
  });

  it('tick atildiktan sonra basa doner', () => {
    const loop = new FixedTimestep(TICK);
    const counter = counting();
    loop.advance(TICK, counter.step);
    expect(loop.alpha).toBeCloseTo(0, 6);
  });
});

describe('FixedTimestep — reset', () => {
  it('birikeni sifirlar', () => {
    const loop = new FixedTimestep(TICK);
    const counter = counting();
    loop.advance(TICK * 0.7, counter.step);
    loop.reset();
    expect(loop.accumulator).toBe(0);
    expect(loop.alpha).toBe(0);
  });
});

describe('varsayilan sinir', () => {
  it('makul bir deger', () => {
    expect(DEFAULT_MAX_TICKS_PER_FRAME).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_MAX_TICKS_PER_FRAME).toBeLessThanOrEqual(20);
  });
});
