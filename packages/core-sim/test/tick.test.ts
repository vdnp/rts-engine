import type { UnitTypeId } from '@bfme/schema';
import { Rng } from '@bfme/sim-math';
import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { type Entity, NULL_ENTITY, entitySlot, makeEntity } from '../src/entity';
import { formatStateHash, hashState } from '../src/hash';
import {
  type ReadonlySimState,
  type SimState,
  createSimState,
  destroy,
  entityAt,
  isAlive,
  readI32,
  readU8,
  spawn,
} from '../src/state';
import { tick } from '../src/tick';
import { makeContent, w } from './support';

const content = makeContent();
const WALKER = 0 as UnitTypeId;

const spawnAt = (posX: number, posY: number, unitType: UnitTypeId = WALKER): Command => ({
  kind: 'spawnUnit',
  unitType,
  owner: 0,
  posX,
  posY,
  facing: 0,
});

describe('tick', () => {
  it('tick sayacini arttirir', () => {
    const state = createSimState(8);
    expect(state.tick).toBe(0);
    tick(state, [], content);
    tick(state, [], content);
    expect(state.tick).toBe(2);
  });

  it('komut, hareket, saglik sirasini korur', () => {
    const state = createSimState(8);
    // Ayni tick icinde yaratilan varlik ayni tick icinde hareket etmelidir:
    // bu, komutlarin hareketten ONCE islendiginin kanitidir.
    tick(state, [spawnAt(0, 0)], content);
    const entity = entityAt(state, 0);
    expect(entity).not.toBe(NULL_ENTITY);

    tick(state, [{ kind: 'moveOrder', entity, targetX: w(10), targetY: 0 }], content);
    expect(readI32(state.posX, 0)).toBeGreaterThan(0);
  });

  it('sagligi biten varlik ayni tick icinde yok edilir', () => {
    const state = createSimState(8);
    tick(state, [spawnAt(0, 0)], content);
    const entity = entityAt(state, 0);
    state.health[0] = 0;
    tick(state, [], content);
    expect(isAlive(state, entity)).toBe(false);
  });
});

describe('gecersiz komutlar', () => {
  it('tanimsiz birim tipinde varlik yaratmaz ve patlamaz', () => {
    const state = createSimState(8);
    expect(() => {
      tick(state, [spawnAt(0, 0, 99 as UnitTypeId)], content);
    }).not.toThrow();
    expect(state.entityCount).toBe(0);
  });

  it('bayat taniticiye verilen emir yok sayilir', () => {
    const state = createSimState(8);
    tick(state, [spawnAt(0, 0)], content);
    const stale = entityAt(state, 0);
    destroy(state, stale);
    tick(state, [spawnAt(w(5), w(5))], content);

    const fresh = entityAt(state, 0);
    tick(state, [{ kind: 'moveOrder', entity: stale, targetX: w(50), targetY: 0 }], content);

    // yeni varlik emri almamis olmali
    expect(readU8(state.moving, entitySlot(fresh))).toBe(0);
    expect(readI32(state.posX, entitySlot(fresh))).toBe(w(5));
  });

  it('hic ayrilmamis slotun taniticisi yok sayilir', () => {
    const state = createSimState(8);
    expect(() => {
      tick(
        state,
        [{ kind: 'moveOrder', entity: makeEntity(5, 1), targetX: 0, targetY: 0 }],
        content,
      );
    }).not.toThrow();
  });

  it('bulundugu yere verilen emir hareket baslatmaz', () => {
    const state = createSimState(8);
    tick(state, [spawnAt(w(3), w(4))], content);
    const entity = entityAt(state, 0);
    tick(state, [{ kind: 'moveOrder', entity, targetX: w(3), targetY: w(4) }], content);
    expect(readU8(state.moving, 0)).toBe(0);
  });
});

describe('hashState', () => {
  function seeded(): SimState {
    const state = createSimState(8);
    spawn(state, {
      unitType: 0,
      owner: 1,
      posX: w(1),
      posY: w(2),
      facing: 100,
      maxHealth: 100,
    });
    return state;
  }

  it('ayni durum ayni hash', () => {
    expect(hashState(seeded())).toBe(hashState(seeded()));
  });

  it('bos durumlar esittir, kapasite hash-e girmez', () => {
    expect(hashState(createSimState(4))).toBe(hashState(createSimState(1024)));
  });

  it.each([
    'posX',
    'posY',
    'facing',
    'velX',
    'velY',
    'targetX',
    'targetY',
    'health',
    'maxHealth',
    'owner',
    'unitType',
    'generation',
  ] as const)('%s alanindaki degisiklik hash-i degistirir', (field) => {
    const base = seeded();
    const before = hashState(base);
    base[field][0] = readI32(base[field], 0) + 1;
    expect(hashState(base)).not.toBe(before);
  });

  it('moving bayragindaki degisiklik hash-i degistirir', () => {
    const base = seeded();
    const before = hashState(base);
    base.moving[0] = 1;
    expect(hashState(base)).not.toBe(before);
  });

  it('tick sayaci hash-e girer', () => {
    const base = seeded();
    const before = hashState(base);
    base.tick = base.tick + 1;
    expect(hashState(base)).not.toBe(before);
  });

  it('serbest slot yigini hash-e girer', () => {
    // Ayni canli varliklara sahip iki durum, serbest yiginlari farkliysa
    // GELECEKTE farkli davranir; hash bunu gormek zorundadir.
    const a = createSimState(8);
    const b = createSimState(8);
    for (const state of [a, b]) {
      for (let i = 0; i < 3; i++) {
        spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
      }
    }
    destroy(a, entityAt(a, 0));
    destroy(a, entityAt(a, 1));
    destroy(b, entityAt(b, 1));
    destroy(b, entityAt(b, 0));

    expect(a.entityCount).toBe(b.entityCount);
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('formatStateHash sekiz haneli onaltilik verir', () => {
    expect(formatStateHash(0)).toBe('00000000');
    expect(formatStateHash(0xdeadbeef)).toBe('deadbeef');
  });
});

describe('determinizm', () => {
  /** Ayni senaryoyu bagimsiz iki durumda kosar ve her tick-te hash karsilastirir. */
  function scenario(state: SimState, ticks: number, onTick: (t: number) => void): number[] {
    const hashes: number[] = [];
    for (let t = 0; t < ticks; t++) {
      onTick(t);
      hashes.push(hashState(state));
    }
    return hashes;
  }

  it('ayni komut akisi iki bagimsiz durumda ayni hash dizisini verir', () => {
    const run = (): number[] => {
      const state = createSimState(16);
      const rng = Rng.create(1234, 9);
      return scenario(state, 300, () => {
        tick(state, nextCommands(state, rng), content);
      });
    };
    expect(run()).toEqual(run());
  });

  it('farkli seed farkli sonuc verir', () => {
    const run = (seed: number): number => {
      const state = createSimState(16);
      const rng = Rng.create(seed, 9);
      for (let t = 0; t < 300; t++) tick(state, nextCommands(state, rng), content);
      return hashState(state);
    };
    expect(run(1)).not.toBe(run(2));
  });

  it('baslangic kapasitesi sonucu etkilemez', () => {
    const run = (capacity: number): number => {
      const state = createSimState(capacity);
      const rng = Rng.create(777, 3);
      for (let t = 0; t < 300; t++) tick(state, nextCommands(state, rng), content);
      return hashState(state);
    };
    expect(run(1)).toBe(run(256));
  });
});

/** Deterministik komut akisi: replay aracinin yapacaginin kucuk bir orneği. */
function nextCommands(state: SimState, rng: Rng): Command[] {
  const commands: Command[] = [];
  const tickNumber = state.tick;

  if (tickNumber % 7 === 0 && state.entityCount < 24) {
    commands.push({
      kind: 'spawnUnit',
      unitType: rng.nextInt(content.unitTypes.length) as UnitTypeId,
      owner: rng.nextInt(2),
      posX: rng.nextInt(128 * 65536),
      posY: rng.nextInt(128 * 65536),
      facing: rng.nextInt(65536),
    });
  }

  if (tickNumber % 13 === 0) {
    for (let slot = 0; slot < state.highWater; slot++) {
      const entity: Entity = entityAt(state, slot);
      if (entity === NULL_ENTITY) continue;
      commands.push({
        kind: 'moveOrder',
        entity,
        targetX: rng.nextInt(128 * 65536),
        targetY: rng.nextInt(128 * 65536),
      });
    }
  }

  return commands;
}

describe('golden', () => {
  it('1000 tick-lik senaryonun hash-i degismedi', async () => {
    const state = createSimState(16);
    const rng = Rng.create(42, 54);
    const checkpoints: string[] = [];

    for (let t = 0; t < 1000; t++) {
      tick(state, nextCommands(state, rng), content);
      if ((t + 1) % 100 === 0) {
        checkpoints.push(
          `tick ${String(t + 1).padStart(4, ' ')}  hash ${formatStateHash(hashState(state))}  varlik ${String(state.entityCount).padStart(3, ' ')}  slot ${String(state.highWater).padStart(3, ' ')}`,
        );
      }
    }

    await expect(`${checkpoints.join('\n')}\n`).toMatchFileSnapshot('./golden/tick-1000.txt');
  });
});

describe('present sinirı', () => {
  it('ReadonlySimState yazmayi derleme zamaninda engeller', () => {
    const state: ReadonlySimState = createSimState(4);

    // Okumak serbesttir.
    expect(state.tick).toBe(0);
    expect(readI32(state.posX, 0)).toBe(0);
    expect(readU8(state.alive, 0)).toBe(0);

    // Asagidaki govde ASLA calistirilmaz; sinav derleme zamanindadir.
    // readonly bir TİP garantisidir, calisma aninda bir sey engellemez.
    // Yazma serbest birakilirsa `@ts-expect-error` kullanilmaz hale gelir ve
    // `pnpm typecheck` kirilir — kontrol budur.
    const forbidden = (): void => {
      // @ts-expect-error present katmani sim durumunu degistiremez
      state.tick = 5;
      // @ts-expect-error tipli diziler present tarafina salt okunur gelir
      state.posX[0] = 1;
      // @ts-expect-error salt okunur gorunumde yazma yontemleri hic yoktur
      const writers: unknown = [state.posX.fill, state.posX.set, state.posX.sort];
      void writers;
    };
    expect(forbidden).toBeTypeOf('function');
  });
});
