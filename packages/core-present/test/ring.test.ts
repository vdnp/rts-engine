import { type SimState, createSimState, destroy, entityAt, spawn, tick } from '@bfme/core-sim';
import { describe, expect, it } from 'vitest';
import { TransformRing, isContinuous } from '../src/ring';
import { makeContent, w } from './support';

const content = makeContent();

function stateWithOne(posX = 0, posY = 0): { state: SimState } {
  const state = createSimState(8);
  spawn(state, {
    unitType: 0,
    owner: 3,
    posX,
    posY,
    facing: 1234,
    maxHealth: 100,
  });
  return { state };
}

describe('TransformRing — kurulus', () => {
  it('gecersiz kapasiteyi reddeder', () => {
    expect(() => new TransformRing(0)).toThrow(RangeError);
    expect(() => new TransformRing(-4)).toThrow(RangeError);
    expect(() => new TransformRing(1.5)).toThrow(RangeError);
  });

  it('bos halkada iki goruntu de bostur', () => {
    const ring = new TransformRing(4);
    expect(ring.snapshotCount).toBe(0);
    expect(ring.current.highWater).toBe(0);
    expect(ring.previous).toBe(ring.current);
  });
});

describe('TransformRing — yakalama', () => {
  it('gorsel alanlari kopyalar', () => {
    const { state } = stateWithOne(w(5), w(-7));
    const ring = new TransformRing(8);
    ring.capture(state);

    expect(ring.snapshotCount).toBe(1);
    expect(ring.current.highWater).toBe(1);
    expect(ring.current.tick).toBe(0);
    expect(ring.current.alive[0]).toBe(1);
    expect(ring.current.posX[0]).toBe(w(5));
    expect(ring.current.posY[0]).toBe(w(-7));
    expect(ring.current.facing[0]).toBe(1234);
    expect(ring.current.owner[0]).toBe(3);
    expect(ring.current.unitType[0]).toBe(0);
  });

  it('tek goruntude onceki = simdiki', () => {
    const { state } = stateWithOne();
    const ring = new TransformRing(8);
    ring.capture(state);
    expect(ring.previous).toBe(ring.current);
  });

  it('iki goruntuden sonra ikisi ayrilir', () => {
    const { state } = stateWithOne();
    const ring = new TransformRing(8);
    ring.capture(state);
    state.posX[0] = w(10);
    state.tick = 1;
    ring.capture(state);

    expect(ring.snapshotCount).toBe(2);
    expect(ring.current).not.toBe(ring.previous);
    expect(ring.current.posX[0]).toBe(w(10));
    expect(ring.previous.posX[0]).toBe(0);
    expect(ring.current.tick).toBe(1);
    expect(ring.previous.tick).toBe(0);
  });

  it('ucuncu yakalama en eskiyi atar (iki slot)', () => {
    const { state } = stateWithOne();
    const ring = new TransformRing(8);
    for (const x of [0, 10, 20]) {
      state.posX[0] = w(x);
      ring.capture(state);
    }
    expect(ring.current.posX[0]).toBe(w(20));
    expect(ring.previous.posX[0]).toBe(w(10));
    expect(ring.snapshotCount).toBe(2);
  });

  it('sim buyuyunce halka da buyur ve onceki goruntu korunur', () => {
    const state = createSimState(1);
    spawn(state, { unitType: 0, owner: 0, posX: w(1), posY: 0, facing: 0, maxHealth: 100 });

    const ring = new TransformRing(1);
    ring.capture(state);

    for (let i = 0; i < 20; i++) {
      spawn(state, { unitType: 0, owner: 0, posX: w(i), posY: 0, facing: 0, maxHealth: 100 });
    }
    ring.capture(state);

    expect(ring.current.highWater).toBe(21);
    // buyume oncesi yakalanan goruntu bozulmamis olmali
    expect(ring.previous.highWater).toBe(1);
    expect(ring.previous.posX[0]).toBe(w(1));
    expect(ring.current.posX[0]).toBe(w(1));
  });

  it('reset halkayi bosaltir', () => {
    const { state } = stateWithOne(w(5));
    const ring = new TransformRing(8);
    ring.capture(state);
    ring.capture(state);
    ring.reset();

    expect(ring.snapshotCount).toBe(0);
    expect(ring.current.highWater).toBe(0);
    expect(ring.current.posX[0]).toBe(0);
    expect(ring.previous).toBe(ring.current);
  });
});

describe('isContinuous', () => {
  it('ayni varlik icin dogru', () => {
    const { state } = stateWithOne();
    const ring = new TransformRing(8);
    ring.capture(state);
    tick(state, [], content);
    ring.capture(state);

    expect(isContinuous(ring.previous, ring.current, 0)).toBe(true);
  });

  it('yeni dogmus varlik icin yanlis', () => {
    const state = createSimState(8);
    const ring = new TransformRing(8);
    ring.capture(state);

    spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    ring.capture(state);

    // onceki goruntude bu slot hic yoktu
    expect(isContinuous(ring.previous, ring.current, 0)).toBe(false);
  });

  it('geri donusturulmus slot icin yanlis (isinlanma korumasi)', () => {
    const state = createSimState(8);
    spawn(state, { unitType: 0, owner: 0, posX: w(1), posY: 0, facing: 0, maxHealth: 100 });

    const ring = new TransformRing(8);
    ring.capture(state);

    // ayni slotu bosaltip baska bir varliga ver
    destroy(state, entityAt(state, 0));
    spawn(state, { unitType: 0, owner: 0, posX: w(90), posY: 0, facing: 0, maxHealth: 100 });
    ring.capture(state);

    expect(ring.current.alive[0]).toBe(1);
    expect(ring.previous.alive[0]).toBe(1);
    // ikisi de canli ama AYNI varlik degil
    expect(isContinuous(ring.previous, ring.current, 0)).toBe(false);
  });

  it('onceki goruntude olu slot icin yanlis', () => {
    const state = createSimState(8);
    const entity = spawn(state, {
      unitType: 0,
      owner: 0,
      posX: 0,
      posY: 0,
      facing: 0,
      maxHealth: 100,
    });
    spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    destroy(state, entity);

    const ring = new TransformRing(8);
    ring.capture(state);
    spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    ring.capture(state);

    expect(isContinuous(ring.previous, ring.current, 0)).toBe(false);
  });
});
