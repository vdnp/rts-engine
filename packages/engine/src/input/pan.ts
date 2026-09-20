/**
 * Kaydirma girdisinin saf hesabi.
 *
 * DOM olaylari `device.ts` icinde toplanir; burada yalnizca sayilar var,
 * dolayisiyla tarayici olmadan test edilebilir.
 */

/** Yon tuslarinin anlik durumu. */
export interface PanKeys {
  readonly forward: boolean;
  readonly back: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

/** Ekran uzayinda kaydirma yonu, bilesenleri -1..1. */
export interface PanVector {
  readonly right: number;
  readonly forward: number;
}

export const NO_PAN: PanVector = { right: 0, forward: 0 };

/** Tus kodundan yon adina esleme. WASD ve yon tuslari. */
export const PAN_KEY_CODES: Readonly<Record<string, keyof PanKeys>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** Basili tus kumesinden yon durumu uretir. */
export function panKeysFrom(pressed: ReadonlySet<string>): PanKeys {
  const keys = { forward: false, back: false, left: false, right: false };
  for (const code of Object.keys(PAN_KEY_CODES)) {
    if (!pressed.has(code)) continue;
    const direction = PAN_KEY_CODES[code];
    if (direction !== undefined) keys[direction] = true;
  }
  return keys;
}

/** Tus durumundan kaydirma vektoru. Karsit tuslar birbirini goturur. */
export function keyboardPan(keys: PanKeys): PanVector {
  return {
    right: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
    forward: (keys.forward ? 1 : 0) - (keys.back ? 1 : 0),
  };
}

/** İsaretcinin goruntu alanindaki yeri. */
export interface PointerSample {
  readonly x: number;
  readonly y: number;
  /** İsaretci goruntu alaninin icinde mi. Disaridaysa kenar kaydirma durur. */
  readonly inside: boolean;
}

/** Goruntu alani olculeri, piksel. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/**
 * Ekran kenarindan kaydirma.
 *
 * Kenar seridine girildikce yogunluk 0'dan 1'e dogru artar; bu, ani siçrama
 * yerine yumusak bir hizlanma verir. Y ekseni ters cevrilir: ekranin ustu
 * ileri yondur.
 *
 * @param edgeSize Kenar seridinin kalinligi, piksel. Pozitif olmali.
 */
export function edgePan(pointer: PointerSample, viewport: Viewport, edgeSize: number): PanVector {
  if (!pointer.inside || edgeSize <= 0) return NO_PAN;
  if (viewport.width <= 0 || viewport.height <= 0) return NO_PAN;

  let right = 0;
  if (pointer.x < edgeSize) {
    right = -(edgeSize - pointer.x) / edgeSize;
  } else if (pointer.x > viewport.width - edgeSize) {
    right = (pointer.x - (viewport.width - edgeSize)) / edgeSize;
  }

  let forward = 0;
  if (pointer.y < edgeSize) {
    forward = (edgeSize - pointer.y) / edgeSize;
  } else if (pointer.y > viewport.height - edgeSize) {
    forward = -(pointer.y - (viewport.height - edgeSize)) / edgeSize;
  }

  return { right: clampUnit(right), forward: clampUnit(forward) };
}

/**
 * İki kaydirma kaynagini birlestirir ve sonucu birim cember icine kirpar,
 * boylece kosegen kaydirma eksen kaydirmasindan hizli olmaz.
 */
export function combinePan(a: PanVector, b: PanVector): PanVector {
  const right = a.right + b.right;
  const forward = a.forward + b.forward;
  const length = Math.hypot(right, forward);
  if (length <= 1) return { right, forward };
  return { right: right / length, forward: forward / length };
}

function clampUnit(value: number): number {
  return value < -1 ? -1 : value > 1 ? 1 : value;
}
