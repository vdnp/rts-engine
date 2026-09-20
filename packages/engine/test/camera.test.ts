import { describe, expect, it } from 'vitest';
import {
  type CameraConfig,
  DEFAULT_CAMERA_CONFIG,
  cameraPosition,
  cameraTarget,
  createCameraState,
  updateCamera,
} from '../src/camera';

const config: CameraConfig = {
  ...DEFAULT_CAMERA_CONFIG,
  yaw: 0,
  pitch: Math.PI / 4,
  minDistance: 10,
  maxDistance: 100,
  zoomFactor: 2,
  panSpeed: 1,
  bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
};

const still = { panRight: 0, panForward: 0, zoomSteps: 0, dt: 1 };

describe('createCameraState', () => {
  it('sinirlarin ortasina bakar', () => {
    const state = createCameraState(config);
    expect(state.targetX).toBe(0);
    expect(state.targetZ).toBe(0);
    expect(state.distance).toBe(55);
  });

  it('mesafeyi sinirlar icine kirpar', () => {
    const state = createCameraState({ ...config, minDistance: 80, maxDistance: 90 });
    expect(state.distance).toBeGreaterThanOrEqual(80);
    expect(state.distance).toBeLessThanOrEqual(90);
  });
});

describe('updateCamera — kaydirma', () => {
  const start = { targetX: 0, targetZ: 0, distance: 10 };

  it('girdi yoksa durum degismez', () => {
    expect(updateCamera(start, still, config)).toEqual(start);
  });

  it('saga kaydirma +X yonunde gider', () => {
    const next = updateCamera(start, { ...still, panRight: 1 }, config);
    expect(next.targetX).toBeCloseTo(10, 6);
    expect(next.targetZ).toBeCloseTo(0, 6);
  });

  it('ileri kaydirma +Z yonunde gider', () => {
    const next = updateCamera(start, { ...still, panForward: 1 }, config);
    expect(next.targetZ).toBeCloseTo(10, 6);
    expect(next.targetX).toBeCloseTo(0, 6);
  });

  it('karsit yonler birbirini goturur', () => {
    const next = updateCamera(start, { ...still, panRight: 1, panForward: 0 }, config);
    const back = updateCamera(next, { ...still, panRight: -1 }, config);
    expect(back.targetX).toBeCloseTo(0, 6);
  });

  it('hiz mesafeyle orantilidir', () => {
    const near = updateCamera({ ...start, distance: 10 }, { ...still, panRight: 1 }, config);
    const far = updateCamera({ ...start, distance: 40 }, { ...still, panRight: 1 }, config);
    expect(far.targetX).toBeCloseTo(near.targetX * 4, 6);
  });

  it('gecen sureyle orantilidir', () => {
    const half = updateCamera(start, { ...still, panRight: 1, dt: 0.5 }, config);
    const full = updateCamera(start, { ...still, panRight: 1, dt: 1 }, config);
    expect(full.targetX).toBeCloseTo(half.targetX * 2, 6);
  });

  it('sinirlarin disina cikamaz', () => {
    let state = start;
    for (let i = 0; i < 100; i++) {
      state = updateCamera(state, { ...still, panRight: 1, panForward: 1 }, config);
    }
    expect(state.targetX).toBe(50);
    expect(state.targetZ).toBe(50);

    for (let i = 0; i < 200; i++) {
      state = updateCamera(state, { ...still, panRight: -1, panForward: -1 }, config);
    }
    expect(state.targetX).toBe(-50);
    expect(state.targetZ).toBe(-50);
  });

  it('yaw dondurulunce kaydirma yonu de doner', () => {
    const turned: CameraConfig = { ...config, yaw: Math.PI / 2 };
    const next = updateCamera(start, { ...still, panRight: 1 }, turned);
    // 90 derece dondurulmus kamerada "sag" +Z yonudur
    expect(next.targetZ).toBeCloseTo(10, 6);
    expect(next.targetX).toBeCloseTo(0, 6);
  });
});

describe('updateCamera — yakinlastirma', () => {
  const start = { targetX: 0, targetZ: 0, distance: 40 };

  it('pozitif tik uzaklastirir, negatif yakinlastirir', () => {
    expect(updateCamera(start, { ...still, zoomSteps: 1 }, config).distance).toBe(80);
    expect(updateCamera(start, { ...still, zoomSteps: -1 }, config).distance).toBe(20);
  });

  it('mesafe sinirlari asilmaz', () => {
    expect(updateCamera(start, { ...still, zoomSteps: 10 }, config).distance).toBe(100);
    expect(updateCamera(start, { ...still, zoomSteps: -10 }, config).distance).toBe(10);
  });

  it('kesirli tikler kabul edilir', () => {
    const next = updateCamera(start, { ...still, zoomSteps: 0.5 }, config);
    expect(next.distance).toBeCloseTo(40 * Math.SQRT2, 6);
  });

  it('yakinlastirma ayni karede kaydirma hizini etkiler', () => {
    // once yakinlastirilir, sonra kaydirilir: yakin planda kaydirma yavaslar
    const next = updateCamera(start, { ...still, zoomSteps: -1, panRight: 1 }, config);
    expect(next.targetX).toBeCloseTo(20, 6);
  });
});

describe('kamera konumu', () => {
  it('hedefin arkasinda ve ustunde durur', () => {
    const state = { targetX: 5, targetZ: -3, distance: 20 };
    const position = cameraPosition(state, { ...config, yaw: 0, pitch: Math.PI / 4 });
    const horizontal = 20 * Math.cos(Math.PI / 4);
    expect(position.x).toBeCloseTo(5, 6);
    expect(position.y).toBeCloseTo(20 * Math.sin(Math.PI / 4), 6);
    expect(position.z).toBeCloseTo(-3 - horizontal, 6);
  });

  it('hedefe uzakligi tam olarak distance kadardir', () => {
    const state = { targetX: 12, targetZ: 7, distance: 33 };
    const position = cameraPosition(state, config);
    const target = cameraTarget(state);
    const dx = position.x - target.x;
    const dy = position.y - target.y;
    const dz = position.z - target.z;
    expect(Math.hypot(dx, dy, dz)).toBeCloseTo(33, 6);
  });

  it('tam tepeden bakista yatay sapma yoktur', () => {
    const state = { targetX: 4, targetZ: 9, distance: 30 };
    const position = cameraPosition(state, { ...config, pitch: Math.PI / 2 });
    expect(position.x).toBeCloseTo(4, 6);
    expect(position.z).toBeCloseTo(9, 6);
    expect(position.y).toBeCloseTo(30, 6);
  });

  it('cameraTarget zemin duzleminde kalir', () => {
    expect(cameraTarget({ targetX: 1, targetZ: 2, distance: 9 })).toEqual({ x: 1, y: 0, z: 2 });
  });
});

describe('varsayilan yapilandirma', () => {
  it('128x128 zemini kapsar', () => {
    const bounds = DEFAULT_CAMERA_CONFIG.bounds;
    expect(bounds.maxX - bounds.minX).toBe(128);
    expect(bounds.maxZ - bounds.minZ).toBe(128);
  });

  it('yakinlastirma carpani 1-den buyuk', () => {
    expect(DEFAULT_CAMERA_CONFIG.zoomFactor).toBeGreaterThan(1);
    expect(DEFAULT_CAMERA_CONFIG.minDistance).toBeLessThan(DEFAULT_CAMERA_CONFIG.maxDistance);
  });
});
