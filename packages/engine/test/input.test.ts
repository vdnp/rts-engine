import { describe, expect, it } from 'vitest';
import {
  NO_PAN,
  PAN_KEY_CODES,
  combinePan,
  edgePan,
  keyboardPan,
  panKeysFrom,
} from '../src/input/pan';

const viewport = { width: 800, height: 600 };
const at = (x: number, y: number, inside = true) => ({ x, y, inside });

describe('panKeysFrom', () => {
  it('WASD tuslarini cozer', () => {
    expect(panKeysFrom(new Set(['KeyW']))).toEqual({
      forward: true,
      back: false,
      left: false,
      right: false,
    });
    expect(panKeysFrom(new Set(['KeyA', 'KeyS']))).toEqual({
      forward: false,
      back: true,
      left: true,
      right: false,
    });
  });

  it('yon tuslarini da cozer', () => {
    expect(panKeysFrom(new Set(['ArrowUp'])).forward).toBe(true);
    expect(panKeysFrom(new Set(['ArrowRight'])).right).toBe(true);
  });

  it('ilgisiz tuslari yok sayar', () => {
    expect(panKeysFrom(new Set(['KeyQ', 'Space', 'Escape']))).toEqual({
      forward: false,
      back: false,
      left: false,
      right: false,
    });
  });

  it('esleme WASD ve dort yon tusunu kapsar', () => {
    expect(Object.keys(PAN_KEY_CODES)).toHaveLength(8);
  });
});

describe('keyboardPan', () => {
  it('tek yon birim vektor verir', () => {
    expect(keyboardPan(panKeysFrom(new Set(['KeyD'])))).toEqual({ right: 1, forward: 0 });
    expect(keyboardPan(panKeysFrom(new Set(['KeyS'])))).toEqual({ right: 0, forward: -1 });
  });

  it('karsit tuslar birbirini goturur', () => {
    expect(keyboardPan(panKeysFrom(new Set(['KeyA', 'KeyD'])))).toEqual(NO_PAN);
    expect(keyboardPan(panKeysFrom(new Set(['KeyW', 'KeyS'])))).toEqual(NO_PAN);
  });

  it('kosegen iki bileseni de doldurur', () => {
    expect(keyboardPan(panKeysFrom(new Set(['KeyW', 'KeyD'])))).toEqual({
      right: 1,
      forward: 1,
    });
  });
});

describe('edgePan', () => {
  it('ortadayken kaydirma yok', () => {
    expect(edgePan(at(400, 300), viewport, 24)).toEqual(NO_PAN);
  });

  it('sol kenarda sola, sag kenarda saga kaydirir', () => {
    expect(edgePan(at(0, 300), viewport, 24).right).toBe(-1);
    expect(edgePan(at(800, 300), viewport, 24).right).toBe(1);
  });

  it('ust kenarda ileri, alt kenarda geri kaydirir', () => {
    expect(edgePan(at(400, 0), viewport, 24).forward).toBe(1);
    expect(edgePan(at(400, 600), viewport, 24).forward).toBe(-1);
  });

  it('kenara yaklastikca yogunluk artar', () => {
    const near = edgePan(at(6, 300), viewport, 24).right;
    const far = edgePan(at(18, 300), viewport, 24).right;
    expect(near).toBeLessThan(far);
    expect(near).toBeCloseTo(-0.75, 6);
    expect(far).toBeCloseTo(-0.25, 6);
  });

  it('koseler iki ekseni birden verir', () => {
    const corner = edgePan(at(0, 0), viewport, 24);
    expect(corner).toEqual({ right: -1, forward: 1 });
  });

  it('isaretci disaridayken durur', () => {
    expect(edgePan(at(0, 0, false), viewport, 24)).toEqual(NO_PAN);
  });

  it('bozuk olculerde patlamaz', () => {
    expect(edgePan(at(0, 0), { width: 0, height: 0 }, 24)).toEqual(NO_PAN);
    expect(edgePan(at(0, 0), viewport, 0)).toEqual(NO_PAN);
    expect(edgePan(at(0, 0), viewport, -5)).toEqual(NO_PAN);
  });

  it('sonuc her zaman -1..1 araliginda', () => {
    for (const x of [-100, 0, 12, 400, 788, 900]) {
      for (const y of [-100, 0, 12, 300, 588, 700]) {
        const pan = edgePan(at(x, y), viewport, 24);
        expect(pan.right).toBeGreaterThanOrEqual(-1);
        expect(pan.right).toBeLessThanOrEqual(1);
        expect(pan.forward).toBeGreaterThanOrEqual(-1);
        expect(pan.forward).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('combinePan', () => {
  it('kaynaklari toplar', () => {
    expect(combinePan({ right: 0.5, forward: 0 }, { right: 0.25, forward: 0 })).toEqual({
      right: 0.75,
      forward: 0,
    });
  });

  it('birim cemberin disina tasmaz', () => {
    const combined = combinePan({ right: 1, forward: 1 }, { right: 1, forward: 1 });
    expect(Math.hypot(combined.right, combined.forward)).toBeCloseTo(1, 6);
  });

  it('kosegen kaydirma eksen kaydirmasindan hizli olmaz', () => {
    const diagonal = combinePan({ right: 1, forward: 1 }, NO_PAN);
    const axis = combinePan({ right: 1, forward: 0 }, NO_PAN);
    expect(Math.hypot(diagonal.right, diagonal.forward)).toBeCloseTo(
      Math.hypot(axis.right, axis.forward),
      6,
    );
  });

  it('kucuk vektorleri oldugu gibi birakir', () => {
    expect(combinePan({ right: 0.3, forward: 0.4 }, NO_PAN)).toEqual({
      right: 0.3,
      forward: 0.4,
    });
  });
});
