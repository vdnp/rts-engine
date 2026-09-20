/**
 * Render soyutlamasi.
 *
 * Bu arayuz hicbir render kutuphanesine bagli degildir ve motorun ne cizdigini
 * bilmez: yalnizca "su renkte kutulardan su matrislerle su kadar tane ciz"
 * der. Babylon'a ozgu her sey `babylon/` altindadir.
 */
import type { CameraState } from '../camera';

/**
 * Tek renkli bir ornek (instance) kumesi.
 *
 * Renk kume basinadir, ornek basina degil: her renk kendi cizim cagrisini
 * alir. Faz 0'da renk sayisi oyuncu sayisi kadardir, yani bir avuc.
 */
export interface InstanceBatch {
  /** Kume rengi, her bileseni 0..1. */
  readonly color: readonly [number, number, number];
  /** Cizilecek ornek sayisi. */
  readonly count: number;
  /**
   * `count * 16` kayan noktali sayi: 4x4 donusum matrisleri.
   * Dizi daha uzun olabilir; yalnizca ilk `count * 16` eleman okunur.
   */
  readonly matrices: Float32Array;
}

/** Sahnenin degismeyen gorsel ayarlari. */
export interface SceneConfig {
  /** Kare zeminin kenar uzunlugu, dunya birimi. */
  readonly groundSize: number;
  /** Zemin rengi, 0..1. */
  readonly groundColor: readonly [number, number, number];
  /** Arka plan rengi, 0..1. */
  readonly backgroundColor: readonly [number, number, number];
  /** Cizilen kutunun kenar uzunlugu, dunya birimi. */
  readonly boxSize: number;
}

export const DEFAULT_SCENE_CONFIG: SceneConfig = {
  groundSize: 128,
  groundColor: [0.24, 0.27, 0.2],
  backgroundColor: [0.05, 0.06, 0.08],
  boxSize: 1,
};

export interface Renderer {
  /** Bu kare cizilecek ornek kumelerini verir. */
  setBatches(batches: readonly InstanceBatch[]): void;
  /** Kamerayi uygular ve bir kare cizer. */
  render(camera: CameraState): void;
  /** Goruntu alani olculeri degistiginde cagrilir. */
  resize(): void;
  /** Tum GPU nesnelerini birakir. */
  dispose(): void;
}

/** Bir 4x4 matrisin kayan noktali eleman sayisi. */
export const MATRIX_STRIDE = 16;

/**
 * Y ekseni etrafinda donmus, olceklenmis ve otelenmis bir donusum matrisini
 * `out` dizisine `index` numarali ornek icin yazar.
 *
 * Duzen WebGL'in bekledigi siradir: oteleme 12, 13, 14 numarali elemanlarda.
 *
 * @param yaw Y ekseni etrafinda donus, radyan.
 */
export function writeInstanceMatrix(
  out: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
  scale: number,
  yaw: number,
): void {
  const base = index * MATRIX_STRIDE;
  const cos = Math.cos(yaw) * scale;
  const sin = Math.sin(yaw) * scale;

  out[base] = cos;
  out[base + 1] = 0;
  // `0 - sin`, `-sin` degil: yaw sifirken ikincisi -0 yazar.
  out[base + 2] = 0 - sin;
  out[base + 3] = 0;

  out[base + 4] = 0;
  out[base + 5] = scale;
  out[base + 6] = 0;
  out[base + 7] = 0;

  out[base + 8] = sin;
  out[base + 9] = 0;
  out[base + 10] = cos;
  out[base + 11] = 0;

  out[base + 12] = x;
  out[base + 13] = y;
  out[base + 14] = z;
  out[base + 15] = 1;
}
