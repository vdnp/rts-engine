/**
 * DOM girdi toplayici.
 *
 * Burasi tarayici olaylarina dokunan tek yerdir; hesap yapmaz, yalnizca ham
 * durumu toplar. Kaydirma ve yakinlastirma matematigi `pan.ts` icinde saf
 * fonksiyonlardadir ve tarayici olmadan test edilir.
 */
import {
  type PanVector,
  type PointerSample,
  type Viewport,
  combinePan,
  edgePan,
  keyboardPan,
  panKeysFrom,
} from './pan';

/** Bir kare icin toplanmis girdi. */
export interface InputSnapshot {
  readonly pan: PanVector;
  /** Son ornekten bu yana birikmis tekerlek tiklari. Pozitif = uzaklas. */
  readonly zoomSteps: number;
}

export interface InputOptions {
  /** Kenar kaydirma seridinin kalinligi, piksel. */
  readonly edgeSize: number;
  /** Tarayicinin tekerlek biriminden tik sayisina cevrim. */
  readonly wheelScale: number;
}

export const DEFAULT_INPUT_OPTIONS: InputOptions = {
  edgeSize: 24,
  wheelScale: 0.01,
};

export interface InputDevice {
  /** Bir kare icin girdiyi okur ve birikmis tekerlek sayacini sifirlar. */
  sample(): InputSnapshot;
  /** Tum olay dinleyicilerini kaldirir. */
  dispose(): void;
}

/**
 * Tuvale ve pencereye dinleyici baglar.
 *
 * Klavye pencereye, isaretci tuvale baglanir: tuvalin disina cikan fare kenar
 * kaydirmayi durdurur, ama tuslar calismaya devam eder.
 */
export function attachInput(
  canvas: HTMLCanvasElement,
  options: InputOptions = DEFAULT_INPUT_OPTIONS,
): InputDevice {
  const pressed = new Set<string>();
  let pointer: PointerSample = { x: 0, y: 0, inside: false };
  let wheelAccumulator = 0;

  const onKeyDown = (event: KeyboardEvent): void => {
    pressed.add(event.code);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    pressed.delete(event.code);
  };
  // Sekme degisince tuslar basili kalmasin.
  const onBlur = (): void => {
    pressed.clear();
  };

  const onPointerMove = (event: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    pointer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      inside: true,
    };
  };
  const onPointerLeave = (): void => {
    pointer = { ...pointer, inside: false };
  };
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    wheelAccumulator += event.deltaY * options.wheelScale;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    sample() {
      const viewport: Viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
      const pan = combinePan(
        keyboardPan(panKeysFrom(pressed)),
        edgePan(pointer, viewport, options.edgeSize),
      );
      const zoomSteps = wheelAccumulator;
      wheelAccumulator = 0;
      return { pan, zoomSteps };
    },

    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      pressed.clear();
    },
  };
}
