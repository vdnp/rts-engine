import { describe, expect, it } from 'vitest';
import { MAX_SLOTS, NULL_ENTITY, entityGeneration, entitySlot, makeEntity } from '../src/entity';
import {
  type SimState,
  createSimState,
  destroy,
  destroySlot,
  entityAt,
  grow,
  isAlive,
  readI32,
  readU8,
  spawn,
} from '../src/state';
import { w } from './support';

function newborn(state: SimState, overrides: Partial<Parameters<typeof spawn>[1]> = {}) {
  return spawn(state, {
    unitType: 0,
    owner: 1,
    posX: w(10),
    posY: w(20),
    facing: 0,
    maxHealth: 100,
    ...overrides,
  });
}

describe('tanitici paketleme', () => {
  it('slot ve nesli geri verir', () => {
    const entity = makeEntity(12345, 7);
    expect(entitySlot(entity)).toBe(12345);
    expect(entityGeneration(entity)).toBe(7);
  });

  it('gecerli tanitici hicbir zaman NULL_ENTITY degildir', () => {
    // nesil 1'den basladigi icin slot 0 bile sifirdan farkli tanitici verir
    expect(makeEntity(0, 1)).not.toBe(NULL_ENTITY);
  });

  it('sinir degerlerinde tasmaz', () => {
    const entity = makeEntity(MAX_SLOTS - 1, 2047);
    expect(entitySlot(entity)).toBe(MAX_SLOTS - 1);
    expect(entityGeneration(entity)).toBe(2047);
    expect(entity).toBeGreaterThan(0);
  });
});

describe('createSimState', () => {
  it('bos durum uretir', () => {
    const state = createSimState(8);
    expect(state.tick).toBe(0);
    expect(state.capacity).toBe(8);
    expect(state.highWater).toBe(0);
    expect(state.entityCount).toBe(0);
    expect(state.posX.length).toBe(8);
    expect(state.alive.length).toBe(8);
  });

  it('gecersiz kapasiteyi reddeder', () => {
    expect(() => createSimState(0)).toThrow(RangeError);
    expect(() => createSimState(-1)).toThrow(RangeError);
    expect(() => createSimState(1.5)).toThrow(RangeError);
    expect(() => createSimState(MAX_SLOTS + 1)).toThrow(RangeError);
  });
});

describe('yasam dongusu', () => {
  it('spawn alanlari doldurur', () => {
    const state = createSimState(4);
    const entity = newborn(state);
    const slot = entitySlot(entity);

    expect(isAlive(state, entity)).toBe(true);
    expect(state.entityCount).toBe(1);
    expect(readU8(state.alive, slot)).toBe(1);
    expect(readI32(state.posX, slot)).toBe(w(10));
    expect(readI32(state.posY, slot)).toBe(w(20));
    expect(readI32(state.health, slot)).toBe(100);
    expect(readI32(state.maxHealth, slot)).toBe(100);
    // hedef baslangicta konumun kendisidir, yani varlik durgundur
    expect(readI32(state.targetX, slot)).toBe(w(10));
    expect(readU8(state.moving, slot)).toBe(0);
  });

  it('destroy varligi oldurur ve sayaci dusurur', () => {
    const state = createSimState(4);
    const entity = newborn(state);
    expect(destroy(state, entity)).toBe(true);
    expect(isAlive(state, entity)).toBe(false);
    expect(state.entityCount).toBe(0);
  });

  it('ikinci destroy false doner', () => {
    const state = createSimState(4);
    const entity = newborn(state);
    expect(destroy(state, entity)).toBe(true);
    expect(destroy(state, entity)).toBe(false);
  });

  it('NULL_ENTITY hicbir zaman canli degildir', () => {
    const state = createSimState(4);
    newborn(state);
    expect(isAlive(state, NULL_ENTITY)).toBe(false);
    expect(destroy(state, NULL_ENTITY)).toBe(false);
  });

  it('ayrilmamis slotun taniticisi canli degildir', () => {
    const state = createSimState(4);
    expect(isAlive(state, makeEntity(3, 1))).toBe(false);
  });
});

describe('bayat tanitici tespiti', () => {
  it('slot yeniden kullanilinca eski tanitici gecersizlesir', () => {
    const state = createSimState(4);
    const first = newborn(state);
    const slot = entitySlot(first);
    destroy(state, first);

    const second = newborn(state);
    // ayni slot yeniden kullanilir
    expect(entitySlot(second)).toBe(slot);
    // ama nesil farklidir
    expect(entityGeneration(second)).not.toBe(entityGeneration(first));

    expect(isAlive(state, second)).toBe(true);
    expect(isAlive(state, first)).toBe(false);
    expect(destroy(state, first)).toBe(false);
    // canli varlik hala canli: bayat tanitici onu oldurmedi
    expect(isAlive(state, second)).toBe(true);
  });

  it('nesil sarmasinda 0 atlanir', () => {
    const state = createSimState(1);
    let entity = newborn(state);
    // 2048 nesil = tam bir tur; her turda tanitici sifir olmamali
    for (let i = 0; i < 2100; i++) {
      expect(entity).not.toBe(NULL_ENTITY);
      expect(entityGeneration(entity)).not.toBe(0);
      destroy(state, entity);
      entity = newborn(state);
    }
  });
});

describe('slot geri donusumu', () => {
  it('serbest slotlari LIFO sirayla yeniden kullanir', () => {
    const state = createSimState(8);
    const a = newborn(state);
    const b = newborn(state);
    const c = newborn(state);
    expect([a, b, c].map(entitySlot)).toEqual([0, 1, 2]);

    destroy(state, a);
    destroy(state, c);
    // yigin: [0, 2] -> once 2, sonra 0
    expect(entitySlot(newborn(state))).toBe(2);
    expect(entitySlot(newborn(state))).toBe(0);
    // yigin bosaldi, yeni slot acilir
    expect(entitySlot(newborn(state))).toBe(3);
    expect(state.entityCount).toBe(4);
  });

  it('highWater geri gitmez', () => {
    const state = createSimState(8);
    const a = newborn(state);
    newborn(state);
    expect(state.highWater).toBe(2);
    destroy(state, a);
    expect(state.highWater).toBe(2);
  });
});

describe('kapasite buyutme', () => {
  it('kapasite dolunca ikiye katlanir ve veriyi korur', () => {
    const state = createSimState(2);
    const first = newborn(state, { posX: w(1) });
    newborn(state, { posX: w(2) });
    expect(state.capacity).toBe(2);

    const third = newborn(state, { posX: w(3) });
    expect(state.capacity).toBe(4);
    expect(state.highWater).toBe(3);
    // buyutme once yazilanlari bozmaz
    expect(readI32(state.posX, entitySlot(first))).toBe(w(1));
    expect(readI32(state.posX, entitySlot(third))).toBe(w(3));
    expect(isAlive(state, first)).toBe(true);
  });

  it('cok sayida varlikta tutarli kalir', () => {
    const state = createSimState(1);
    const entities = Array.from({ length: 500 }, () => newborn(state));
    expect(state.entityCount).toBe(500);
    expect(state.capacity).toBeGreaterThanOrEqual(500);
    for (const entity of entities) expect(isAlive(state, entity)).toBe(true);
  });

  it('grow kucultmez ve gereksiz yere calismaz', () => {
    const state = createSimState(16);
    const before = state.posX;
    grow(state, 8);
    expect(state.capacity).toBe(16);
    expect(state.posX).toBe(before);
  });

  it('slot sinirini asmayi reddeder', () => {
    const state = createSimState(2);
    expect(() => {
      grow(state, MAX_SLOTS + 1);
    }).toThrow(RangeError);
  });
});

describe('entityAt', () => {
  it('canli slot icin tanitici, olu slot icin NULL doner', () => {
    const state = createSimState(4);
    const entity = newborn(state);
    expect(entityAt(state, entitySlot(entity))).toBe(entity);
    destroy(state, entity);
    expect(entityAt(state, entitySlot(entity))).toBe(NULL_ENTITY);
  });
});

describe('destroySlot', () => {
  it('zaten olu slotta sayaci bozmaz', () => {
    const state = createSimState(4);
    const entity = newborn(state);
    destroySlot(state, entitySlot(entity));
    destroySlot(state, entitySlot(entity));
    expect(state.entityCount).toBe(0);
    expect(state.freeCount).toBe(1);
  });
});
