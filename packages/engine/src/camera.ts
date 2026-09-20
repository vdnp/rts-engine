/**
 * Ust perspektif kamera matematigi.
 *
 * Bu modul saf fonksiyonlardan olusur: DOM, render kutuphanesi ve kare dongusu
 * bilmez. Kamera bir zemin noktasina sabit bir aci ve degisken bir mesafeden
 * bakar; girdi yalnizca bakilan noktayi ve mesafeyi degistirir.
 *
 * Eksen duzeni saga-elli Y-yukari'dir: zemin XZ duzlemi, +Y yukari.
 */

/** Kameranin degisen durumu. */
export interface CameraState {
  /** Bakilan zemin noktasi. */
  readonly targetX: number;
  readonly targetZ: number;
  /** Bakilan noktaya uzaklik. */
  readonly distance: number;
}

/** Kameranin gezinebilecegi zemin dikdortgeni. */
export interface CameraBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Degismeyen kamera ayarlari. */
export interface CameraConfig {
  /** Yatay bakis yonu, radyan. 0 = -Z yonune bakar. */
  readonly yaw: number;
  /** Egim, radyan. 0 = ufuk hizasi, PI/2 = tam tepeden. */
  readonly pitch: number;
  readonly minDistance: number;
  readonly maxDistance: number;
  /** Tekerlek tiki basina mesafe carpani. 1'den buyuk olmali. */
  readonly zoomFactor: number;
  /** Saniyede kat edilen yol, mesafenin kati olarak. */
  readonly panSpeed: number;
  readonly bounds: CameraBounds;
}

/** Bir kare boyunca toplanan kamera girdisi. */
export interface CameraInput {
  /** Sag yonde kaydirma, -1..1. */
  readonly panRight: number;
  /** İleri yonde kaydirma, -1..1. */
  readonly panForward: number;
  /** Tekerlek tiki sayisi. Pozitif = uzaklas. */
  readonly zoomSteps: number;
  /** Gecen sure, saniye. */
  readonly dt: number;
}

/** Dunya uzayinda bir nokta. */
export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 128x128 zemin icin makul varsayilanlar. */
export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  yaw: 0,
  pitch: Math.PI / 4,
  minDistance: 12,
  maxDistance: 160,
  zoomFactor: 1.15,
  panSpeed: 1.2,
  bounds: { minX: -64, maxX: 64, minZ: -64, maxZ: 64 },
};

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}

/** Yapilandirmaya uygun bir baslangic durumu. */
export function createCameraState(config: CameraConfig = DEFAULT_CAMERA_CONFIG): CameraState {
  const bounds = config.bounds;
  return {
    targetX: (bounds.minX + bounds.maxX) / 2,
    targetZ: (bounds.minZ + bounds.maxZ) / 2,
    distance: clamp(
      (config.minDistance + config.maxDistance) / 2,
      config.minDistance,
      config.maxDistance,
    ),
  };
}

/**
 * Kamerayi bir kare ilerletir.
 *
 * Kaydirma hizi mesafeyle orantilidir: uzaktan bakarken ayni fare hareketi
 * daha cok yol aldirir, boylece haritanin her olceginde ayni his korunur.
 * Sonuc her zaman sinirlar icine kirpilir.
 */
export function updateCamera(
  state: CameraState,
  input: CameraInput,
  config: CameraConfig = DEFAULT_CAMERA_CONFIG,
): CameraState {
  const distance = clamp(
    state.distance * Math.pow(config.zoomFactor, input.zoomSteps),
    config.minDistance,
    config.maxDistance,
  );

  const speed = config.panSpeed * distance * input.dt;
  const sinYaw = Math.sin(config.yaw);
  const cosYaw = Math.cos(config.yaw);

  // ileri = kameranin baktigi yon (zemine izdusumu), sag = ona dik.
  const forwardX = -sinYaw;
  const forwardZ = cosYaw;
  const rightX = cosYaw;
  const rightZ = sinYaw;

  const moveX = (rightX * input.panRight + forwardX * input.panForward) * speed;
  const moveZ = (rightZ * input.panRight + forwardZ * input.panForward) * speed;

  return {
    targetX: clamp(state.targetX + moveX, config.bounds.minX, config.bounds.maxX),
    targetZ: clamp(state.targetZ + moveZ, config.bounds.minZ, config.bounds.maxZ),
    distance,
  };
}

/** Kameranin dunya uzayindaki konumu. */
export function cameraPosition(
  state: CameraState,
  config: CameraConfig = DEFAULT_CAMERA_CONFIG,
): Point3 {
  const horizontal = state.distance * Math.cos(config.pitch);
  return {
    x: state.targetX + Math.sin(config.yaw) * horizontal,
    y: state.distance * Math.sin(config.pitch),
    z: state.targetZ - Math.cos(config.yaw) * horizontal,
  };
}

/** Kameranin baktigi nokta (zemin uzerinde). */
export function cameraTarget(state: CameraState): Point3 {
  return { x: state.targetX, y: 0, z: state.targetZ };
}
