import { createSimState, destroy, entityAt, spawn } from '@bfme/core-sim';
import { MATRIX_STRIDE } from '@bfme/engine';
import { Fx } from '@bfme/sim-math';
import { describe, expect, it } from 'vitest';
import { TransformRing } from '../src/ring';
import { ViewBuilder, placeEntity } from '../src/view';
import { makeContent, w } from './support';

const content = makeContent();

/** Bir kumenin `index` numarali orneginin otelemesi. */
function translationOf(matrices: Float32Array, index: number): [number, number, number] {
  const base = index * MATRIX_STRIDE;
  return [matrices[base + 12] ?? 0, matrices[base + 13] ?? 0, matrices[base + 14] ?? 0];
}

/** Olcek, matrisin kosegeninden okunur (yaw = 0 varsayimiyla). */
function scaleOf(matrices: Float32Array, index: number): number {
  return matrices[index * MATRIX_STRIDE + 5] ?? 0;
}

function ringWith(place: (state: ReturnType<typeof createSimState>) => void): TransformRing {
  const state = createSimState(16);
  place(state);
  const ring = new TransformRing(16);
  ring.capture(state);
  return ring;
}

describe('ViewBuilder — kumeleme', () => {
  it('her fraksiyon icin bir kume verir, sira kimlikle ayni', () => {
    const ring = ringWith((state) => {
      spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
      spawn(state, { unitType: 2, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    });

    const batches = new ViewBuilder().build(ring, content, 0);
    expect(batches).toHaveLength(content.factions.length);
    expect(batches[0]?.count).toBe(1);
    expect(batches[1]?.count).toBe(1);
  });

  it('ayni fraksiyondaki varliklar tek kumede toplanir', () => {
    const ring = ringWith((state) => {
      // unitType 0 ve 1 ayni fraksiyona ait
      spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
      spawn(state, { unitType: 1, owner: 1, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
      spawn(state, { unitType: 2, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    });

    const batches = new ViewBuilder().build(ring, content, 0);
    expect(batches[0]?.count).toBe(2);
    expect(batches[1]?.count).toBe(1);
  });

  it('rengi icerikten alir ve 0..1 araligina cevirir', () => {
    const ring = ringWith((state) => {
      spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    });
    const batches = new ViewBuilder().build(ring, content, 0);
    expect(batches[0]?.color).toEqual([1, 0, 0]);
    expect(batches[1]?.color[2]).toBeCloseTo(1, 6);
    expect(batches[1]?.color[1]).toBeCloseTo(128 / 255, 6);
  });

  it('bos fraksiyon sifir sayili kume verir', () => {
    const ring = ringWith((state) => {
      spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    });
    const batches = new ViewBuilder().build(ring, content, 0);
    expect(batches[1]?.count).toBe(0);
  });

  it('olu varliklari atlar', () => {
    const state = createSimState(16);
    spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    const second = spawn(state, {
      unitType: 0,
      owner: 0,
      posX: 0,
      posY: 0,
      facing: 0,
      maxHealth: 100,
    });
    destroy(state, second);

    const ring = new TransformRing(16);
    ring.capture(state);
    expect(new ViewBuilder().build(ring, content, 0)[0]?.count).toBe(1);
  });

  it('tanimsiz birim tipini atlar, patlamaz', () => {
    const state = createSimState(16);
    spawn(state, { unitType: 99, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    const ring = new TransformRing(16);
    ring.capture(state);

    const batches = new ViewBuilder().build(ring, content, 0);
    expect(batches[0]?.count).toBe(0);
    expect(batches[1]?.count).toBe(0);
  });

  it('bos sim bos kumeler verir', () => {
    const ring = new TransformRing(16);
    ring.capture(createSimState(16));
    const batches = new ViewBuilder().build(ring, content, 0);
    expect(batches.every((batch) => batch.count === 0)).toBe(true);
  });
});

describe('ViewBuilder — yerlesim', () => {
  it('sim XY duzlemini sahne XZ duzlemine esler', () => {
    const ring = ringWith((state) => {
      spawn(state, { unitType: 0, owner: 0, posX: w(12), posY: w(-8), facing: 0, maxHealth: 100 });
    });
    const batches = new ViewBuilder().build(ring, content, 0);
    const [x, , z] = translationOf(batches[0]?.matrices ?? new Float32Array(0), 0);
    expect(x).toBeCloseTo(12, 4);
    expect(z).toBeCloseTo(-8, 4);
  });

  it('kutu zeminin ustunde durur', () => {
    const ring = ringWith((state) => {
      spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    });
    const batches = new ViewBuilder().build(ring, content, 0);
    const matrices = batches[0]?.matrices ?? new Float32Array(0);
    const size = scaleOf(matrices, 0);
    const [, y] = translationOf(matrices, 0);
    // yaricap 0.5 -> kenar 1.0 -> merkez 0.5 yukarida
    expect(size).toBeCloseTo(1, 4);
    expect(y).toBeCloseTo(0.5, 4);
  });

  it('kutu boyu icerikteki yaricaptan gelir', () => {
    const ring = ringWith((state) => {
      spawn(state, { unitType: 1, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    });
    const batches = new ViewBuilder().build(ring, content, 0);
    // unitType 1 yaricapi 0.25 -> kenar 0.5
    expect(scaleOf(batches[0]?.matrices ?? new Float32Array(0), 0)).toBeCloseTo(0.5, 4);
  });

  it('sizeScale kutuyu olcekler', () => {
    const ring = ringWith((state) => {
      spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    });
    const batches = new ViewBuilder({ sizeScale: 3 }).build(ring, content, 0);
    expect(scaleOf(batches[0]?.matrices ?? new Float32Array(0), 0)).toBeCloseTo(3, 4);
  });
});

describe('ViewBuilder — interpolasyon', () => {
  function movingRing(): TransformRing {
    const state = createSimState(16);
    spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    const ring = new TransformRing(16);
    ring.capture(state);
    state.posX[0] = w(10);
    state.posY[0] = w(20);
    ring.capture(state);
    return ring;
  }

  it('alpha 0 onceki tick-i, 1 simdiki tick-i verir', () => {
    const ring = movingRing();
    const builder = new ViewBuilder();

    const atStart = translationOf(
      builder.build(ring, content, 0)[0]?.matrices ?? new Float32Array(0),
      0,
    );
    expect(atStart[0]).toBeCloseTo(0, 4);
    expect(atStart[2]).toBeCloseTo(0, 4);

    const atEnd = translationOf(
      builder.build(ring, content, 1)[0]?.matrices ?? new Float32Array(0),
      0,
    );
    expect(atEnd[0]).toBeCloseTo(10, 4);
    expect(atEnd[2]).toBeCloseTo(20, 4);
  });

  it('alpha 0.5 tam ortayi verir', () => {
    const batches = new ViewBuilder().build(movingRing(), content, 0.5);
    const [x, , z] = translationOf(batches[0]?.matrices ?? new Float32Array(0), 0);
    expect(x).toBeCloseTo(5, 4);
    expect(z).toBeCloseTo(10, 4);
  });

  it('yeni dogmus varlik karistirilmaz, dogdugu yerde durur', () => {
    const state = createSimState(16);
    const ring = new TransformRing(16);
    ring.capture(state);
    spawn(state, { unitType: 0, owner: 0, posX: w(40), posY: w(40), facing: 0, maxHealth: 100 });
    ring.capture(state);

    const batches = new ViewBuilder().build(ring, content, 0);
    const [x, , z] = translationOf(batches[0]?.matrices ?? new Float32Array(0), 0);
    // alpha 0 olmasina ragmen sifira dogru kaymaz
    expect(x).toBeCloseTo(40, 4);
    expect(z).toBeCloseTo(40, 4);
  });

  it('geri donusturulmus slot isinlanmaz', () => {
    const state = createSimState(16);
    spawn(state, { unitType: 0, owner: 0, posX: w(-50), posY: 0, facing: 0, maxHealth: 100 });
    const ring = new TransformRing(16);
    ring.capture(state);

    destroy(state, entityAt(state, 0));
    spawn(state, { unitType: 0, owner: 0, posX: w(50), posY: 0, facing: 0, maxHealth: 100 });
    ring.capture(state);

    const batches = new ViewBuilder().build(ring, content, 0.5);
    const [x] = translationOf(batches[0]?.matrices ?? new Float32Array(0), 0);
    // karistirilsaydi 0 cikardi; yeni varlik kendi yerinde olmali
    expect(x).toBeCloseTo(50, 4);
  });
});

describe('ViewBuilder — tampon yonetimi', () => {
  it('tamponlari kareler arasinda yeniden kullanir', () => {
    const ring = ringWith((state) => {
      spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 0, maxHealth: 100 });
    });
    const builder = new ViewBuilder();
    const first = builder.build(ring, content, 0)[0]?.matrices;
    const second = builder.build(ring, content, 0)[0]?.matrices;
    expect(second).toBe(first);
  });

  it('varlik sayisi artinca tamponu buyutur', () => {
    const state = createSimState(256);
    for (let i = 0; i < 200; i++) {
      spawn(state, { unitType: 0, owner: 0, posX: w(i), posY: 0, facing: 0, maxHealth: 100 });
    }
    const ring = new TransformRing(256);
    ring.capture(state);

    const batches = new ViewBuilder().build(ring, content, 0);
    expect(batches[0]?.count).toBe(200);
    expect((batches[0]?.matrices.length ?? 0) >= 200 * MATRIX_STRIDE).toBe(true);
    // son ornek de dogru yazilmis olmali
    const [x] = translationOf(batches[0]?.matrices ?? new Float32Array(0), 199);
    expect(x).toBeCloseTo(199, 3);
  });
});

describe('placeEntity', () => {
  it('yon acisini radyana cevirir', () => {
    const state = createSimState(16);
    spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 16384, maxHealth: 100 });
    const ring = new TransformRing(16);
    ring.capture(state);

    const placement = placeEntity(ring.previous, ring.current, 0, 0);
    expect(placement.yaw).toBeCloseTo(Math.PI / 2, 6);
  });

  it('yon acisini kisa yaydan karistirir', () => {
    const state = createSimState(16);
    spawn(state, { unitType: 0, owner: 0, posX: 0, posY: 0, facing: 65000, maxHealth: 100 });
    const ring = new TransformRing(16);
    ring.capture(state);
    state.facing[0] = 500;
    ring.capture(state);

    const placement = placeEntity(ring.previous, ring.current, 0, 0.5);
    // 65518 BAM; cemberi geri dolasilsaydi PI civarinda cikardi
    expect(placement.yaw).toBeCloseTo((65518 / 65536) * Math.PI * 2, 4);
  });

  it('Fx degerlerini dunya birimine cevirir', () => {
    const state = createSimState(16);
    spawn(state, {
      unitType: 0,
      owner: 0,
      posX: Fx.of(1.5),
      posY: Fx.of(-2.25),
      facing: 0,
      maxHealth: 100,
    });
    const ring = new TransformRing(16);
    ring.capture(state);

    const placement = placeEntity(ring.previous, ring.current, 0, 0);
    expect(placement.x).toBeCloseTo(1.5, 5);
    expect(placement.z).toBeCloseTo(-2.25, 5);
  });
});
