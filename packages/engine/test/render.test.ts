import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CAMERA_CONFIG, createCameraState } from '../src/camera';
import { createBabylonRenderer } from '../src/render/babylon/babylonRenderer';
import {
  DEFAULT_SCENE_CONFIG,
  type InstanceBatch,
  MATRIX_STRIDE,
  type Renderer,
  writeInstanceMatrix,
} from '../src/render/renderer';

describe('writeInstanceMatrix', () => {
  it('birim donusumde birim matris yazar', () => {
    const out = new Float32Array(MATRIX_STRIDE);
    writeInstanceMatrix(out, 0, 0, 0, 0, 1, 0);
    expect([...out]).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it('otelemeyi 12, 13, 14 numarali elemanlara koyar', () => {
    const out = new Float32Array(MATRIX_STRIDE);
    writeInstanceMatrix(out, 0, 3, 4, 5, 1, 0);
    expect(out[12]).toBe(3);
    expect(out[13]).toBe(4);
    expect(out[14]).toBe(5);
    expect(out[15]).toBe(1);
  });

  it('olcegi kosegene uygular', () => {
    const out = new Float32Array(MATRIX_STRIDE);
    writeInstanceMatrix(out, 0, 0, 0, 0, 2.5, 0);
    expect(out[0]).toBeCloseTo(2.5, 5);
    expect(out[5]).toBeCloseTo(2.5, 5);
    expect(out[10]).toBeCloseTo(2.5, 5);
  });

  it('Y ekseni etrafinda dondurur', () => {
    const out = new Float32Array(MATRIX_STRIDE);
    writeInstanceMatrix(out, 0, 0, 0, 0, 1, Math.PI / 2);
    // 90 derece: [0,0,-1 / 0,1,0 / 1,0,0]
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[2]).toBeCloseTo(-1, 5);
    expect(out[8]).toBeCloseTo(1, 5);
    expect(out[10]).toBeCloseTo(0, 5);
    expect(out[5]).toBeCloseTo(1, 5);
  });

  it('donusum bir noktayi beklenen yere tasir', () => {
    // 90 derece dondurulmus, 2 kat buyutulmus, (10, 0, 0) noktasina otelenmis
    const m = new Float32Array(MATRIX_STRIDE);
    writeInstanceMatrix(m, 0, 10, 0, 0, 2, Math.PI / 2);

    // yerel (1, 0, 0) noktasini donustur: v * M (satir vektoru)
    const x = 1 * (m[0] ?? 0) + 0 * (m[4] ?? 0) + 0 * (m[8] ?? 0) + (m[12] ?? 0);
    const y = 1 * (m[1] ?? 0) + 0 * (m[5] ?? 0) + 0 * (m[9] ?? 0) + (m[13] ?? 0);
    const z = 1 * (m[2] ?? 0) + 0 * (m[6] ?? 0) + 0 * (m[10] ?? 0) + (m[14] ?? 0);

    expect(x).toBeCloseTo(10, 5);
    expect(y).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(-2, 5);
  });

  it('birden cok ornegi yan yana yazar', () => {
    const out = new Float32Array(MATRIX_STRIDE * 3);
    writeInstanceMatrix(out, 0, 1, 0, 0, 1, 0);
    writeInstanceMatrix(out, 1, 2, 0, 0, 1, 0);
    writeInstanceMatrix(out, 2, 3, 0, 0, 1, 0);
    expect(out[12]).toBe(1);
    expect(out[MATRIX_STRIDE + 12]).toBe(2);
    expect(out[MATRIX_STRIDE * 2 + 12]).toBe(3);
  });
});

/**
 * Babylon uygulamasinin bassiz dogrulamasi.
 *
 * `NullEngine` GPU olmadan calisir, bu yuzden sahne grafiginin dogru
 * kuruldugunu ve ornek tamponlarinin dogru baglandigini tarayici acmadan
 * dogrulayabiliyoruz. Piksellerin dogrulugu bunun kapsaminda degil.
 */
describe('Babylon render uygulamasi', () => {
  let engine: NullEngine | undefined;
  let renderer: Renderer | undefined;

  afterEach(() => {
    renderer?.dispose();
    engine?.dispose();
    renderer = undefined;
    engine = undefined;
  });

  function setup(): { engine: NullEngine; renderer: Renderer } {
    const created = new NullEngine();
    const made = createBabylonRenderer(created, DEFAULT_SCENE_CONFIG);
    engine = created;
    renderer = made;
    return { engine: created, renderer: made };
  }

  /** `scene.meshes` AbstractMesh verir; thinInstance* Mesh uzerindedir. */
  function meshNamed(scene: Scene | undefined, name: string): Mesh | undefined {
    return scene?.meshes.find((mesh) => mesh.name === name) as Mesh | undefined;
  }

  function batchMeshes(scene: Scene | undefined): Mesh[] {
    return (scene?.meshes.filter((mesh) => mesh.name.startsWith('batch')) ?? []) as Mesh[];
  }

  const batch = (count: number, color: [number, number, number]): InstanceBatch => {
    const matrices = new Float32Array(count * MATRIX_STRIDE);
    for (let i = 0; i < count; i++) writeInstanceMatrix(matrices, i, i, 0, 0, 1, 0);
    return { color, count, matrices };
  };

  it('sahneyi zemin ve isikla kurar', () => {
    const { engine: created } = setup();
    const scene = created.scenes[0];
    expect(scene).toBeDefined();
    expect(scene?.lights).toHaveLength(1);
    expect(scene?.activeCamera).toBeDefined();

    const ground = meshNamed(scene, 'ground');
    expect(ground).toBeDefined();
    const size = ground?.getBoundingInfo().boundingBox.extendSize;
    expect(size?.x).toBeCloseTo(DEFAULT_SCENE_CONFIG.groundSize / 2, 4);
    expect(size?.z).toBeCloseTo(DEFAULT_SCENE_CONFIG.groundSize / 2, 4);
  });

  it('kume basina bir mesh olusturur ve ornek sayisini baglar', () => {
    const { engine: created, renderer: made } = setup();
    made.setBatches([batch(3, [1, 0, 0]), batch(5, [0, 1, 0])]);

    const scene = created.scenes[0];
    const batches = batchMeshes(scene);
    expect(batches).toHaveLength(2);
    expect(batches[0]?.thinInstanceCount).toBe(3);
    expect(batches[1]?.thinInstanceCount).toBe(5);
    expect(batches.every((mesh) => mesh.isEnabled())).toBe(true);
  });

  it('mesh-leri kareler arasinda yeniden kullanir', () => {
    const { engine: created, renderer: made } = setup();
    made.setBatches([batch(2, [1, 0, 0])]);
    const scene = created.scenes[0];
    const first = meshNamed(scene, 'batch0');

    made.setBatches([batch(7, [1, 0, 0])]);
    const second = meshNamed(scene, 'batch0');

    expect(second).toBe(first);
    expect(second?.thinInstanceCount).toBe(7);
    expect(batchMeshes(scene)).toHaveLength(1);
  });

  it('azalan kume sayisinda fazla mesh-leri gizler', () => {
    const { engine: created, renderer: made } = setup();
    made.setBatches([batch(1, [1, 0, 0]), batch(1, [0, 1, 0])]);
    made.setBatches([batch(1, [1, 0, 0])]);

    const scene = created.scenes[0];
    expect(meshNamed(scene, 'batch0')?.isEnabled()).toBe(true);
    expect(meshNamed(scene, 'batch1')?.isEnabled()).toBe(false);
  });

  it('bos kumeyi gizler', () => {
    const { engine: created, renderer: made } = setup();
    made.setBatches([batch(0, [1, 0, 0])]);
    const scene = created.scenes[0];
    expect(meshNamed(scene, 'batch0')?.isEnabled()).toBe(false);
  });

  it('tamponun yalnizca kullanilan kismini baglar', () => {
    const { engine: created, renderer: made } = setup();
    // 10 ornege yetecek tampon ama sadece 2 ornek cizilecek
    const matrices = new Float32Array(10 * MATRIX_STRIDE);
    writeInstanceMatrix(matrices, 0, 1, 0, 0, 1, 0);
    writeInstanceMatrix(matrices, 1, 2, 0, 0, 1, 0);
    made.setBatches([{ color: [1, 1, 1], count: 2, matrices }]);

    const scene = created.scenes[0];
    expect(meshNamed(scene, 'batch0')?.thinInstanceCount).toBe(2);
  });

  it('kamerayi uygular ve kare cizer', () => {
    const { engine: created, renderer: made } = setup();
    made.setBatches([batch(4, [0.5, 0.5, 1])]);

    const state = { ...createCameraState(DEFAULT_CAMERA_CONFIG), targetX: 10, targetZ: -5 };
    expect(() => {
      made.render(state);
    }).not.toThrow();

    const camera = created.scenes[0]?.activeCamera;
    expect(camera?.position.y).toBeGreaterThan(0);
    // kamera hedefin arkasindan bakar, hedefin uzerinde durmaz
    expect(camera?.position.z).toBeLessThan(-5);
  });

  it('resize ve dispose hata vermez', () => {
    const { renderer: made } = setup();
    expect(() => {
      made.resize();
    }).not.toThrow();
    expect(() => {
      made.dispose();
    }).not.toThrow();
    renderer = undefined;
  });
});
