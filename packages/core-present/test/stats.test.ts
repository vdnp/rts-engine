import { createSimState, spawn } from '@bfme/core-sim';
import { describe, expect, it } from 'vitest';
import { StatsTracker, formatDataHash, formatStats } from '../src/stats';
import { makeContent } from './support';

const content = makeContent();

describe('formatDataHash', () => {
  it('sekiz haneli onaltilik verir', () => {
    expect(formatDataHash(0)).toBe('00000000');
    expect(formatDataHash(0xabcdef12)).toBe('abcdef12');
    expect(formatDataHash(-1)).toBe('ffffffff');
  });
});

describe('StatsTracker', () => {
  it('gecersiz pencereyi reddeder', () => {
    expect(() => new StatsTracker(0)).toThrow(RangeError);
    expect(() => new StatsTracker(-1)).toThrow(RangeError);
  });

  it('pencere dolana kadar oran bildirmez', () => {
    const tracker = new StatsTracker(500);
    const state = createSimState(4);
    for (let i = 0; i < 10; i++) tracker.recordFrame(i * 10);
    expect(tracker.sample(state, content).fps).toBe(0);
  });

  it('pencere dolunca fps hesaplar', () => {
    const tracker = new StatsTracker(500);
    const state = createSimState(4);
    // 60 Hz: t=0 pencereyi acar, sonraki 30 kare 500 ms-i doldurur
    for (let i = 0; i <= 30; i++) tracker.recordFrame(i * (500 / 30));
    expect(tracker.sample(state, content).fps).toBeCloseTo(60, 6);
  });

  it('ardisik pencerelerde ayni orani verir', () => {
    const tracker = new StatsTracker(500);
    const state = createSimState(4);
    const step = 1000 / 60;
    for (let i = 0; i <= 60; i++) tracker.recordFrame(i * step);
    expect(tracker.sample(state, content).fps).toBeCloseTo(60, 6);
  });

  it('tick oranini ayri sayar', () => {
    const tracker = new StatsTracker(1000);
    const state = createSimState(4);
    for (let i = 0; i <= 60; i++) {
      tracker.recordFrame(i * (1000 / 60));
      if (i % 2 === 0) tracker.recordTick();
    }
    const sample = tracker.sample(state, content);
    expect(sample.fps).toBeCloseTo(60, 6);
    // Pencere t=1000'deki kareyle kapanir; o andan SONRA gelen tick bir
    // sonraki pencereye yazilir. Saniyede 30 tick = TICK_RATE.
    expect(sample.ticksPerSecond).toBeCloseTo(30, 6);
  });

  it('pencere kapandiktan sonra sayaclar sifirlanir', () => {
    const tracker = new StatsTracker(100);
    const state = createSimState(4);
    for (let i = 0; i <= 10; i++) tracker.recordFrame(i * 10);
    const first = tracker.sample(state, content).fps;
    // ikinci pencerede yarim hizda
    for (let i = 1; i <= 5; i++) tracker.recordFrame(100 + i * 20);
    const second = tracker.sample(state, content).fps;
    expect(second).toBeLessThan(first);
  });

  it('sim durumunu ve icerik hash-ini yansitir', () => {
    const tracker = new StatsTracker();
    const state = createSimState(8);
    spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    state.tick = 137;

    const sample = tracker.sample(state, content);
    expect(sample.tick).toBe(137);
    expect(sample.entityCount).toBe(2);
    expect(sample.dataHash).toBe('abcdef12');
  });

  it('reset oranlari sifirlar', () => {
    const tracker = new StatsTracker(100);
    const state = createSimState(4);
    for (let i = 0; i <= 10; i++) tracker.recordFrame(i * 10);
    expect(tracker.sample(state, content).fps).toBeGreaterThan(0);

    tracker.reset();
    expect(tracker.sample(state, content).fps).toBe(0);
    expect(tracker.sample(state, content).ticksPerSecond).toBe(0);
  });

  it('saat okumaz: ayni zaman dizisi ayni sonucu verir', () => {
    const run = (): number => {
      const tracker = new StatsTracker(250);
      const state = createSimState(4);
      for (let i = 0; i <= 25; i++) tracker.recordFrame(i * 10);
      return tracker.sample(state, content).fps;
    };
    expect(run()).toBe(run());
  });
});

describe('formatStats', () => {
  it('bes satir uretir ve sayaclari gosterir', () => {
    const lines = formatStats({
      fps: 59.94,
      ticksPerSecond: 30.1,
      tick: 1234,
      entityCount: 42,
      dataHash: 'abcdef12',
    });
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('fps      59.9');
    expect(lines[1]).toBe('tick/s   30.1');
    expect(lines[2]).toBe('tick     1234');
    expect(lines[3]).toBe('varlik   42');
    expect(lines[4]).toBe('icerik   abcdef12');
  });
});
