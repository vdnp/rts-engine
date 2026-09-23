/**
 * Sim durumundan cizim kumelerine kopru.
 *
 * Buradan sim'e TEK BİR YAZMA bile gitmez: girdi `Snapshot`'lar, cikti
 * `InstanceBatch` dizisidir.
 *
 * Kutular fraksiyon rengine gore kumelenir ve kume indeksi fraksiyonun
 * sayisal kimligidir. Boylece kume sirasi kareler arasinda sabit kalir ve
 * render tarafindaki mesh'ler yeniden kullanilabilir.
 *
 * Kutu boyu ve rengi tamamen icerikten gelir: `radius` ve `color`
 * degistirildiginde ekranda aninda gorulur.
 */
import type { InstanceBatch } from '@bfme/engine';
import { MATRIX_STRIDE, writeInstanceMatrix } from '@bfme/engine';
import type { Content } from '@bfme/schema';
import { Fx } from '@bfme/sim-math';
import { bamToRadians, lerp, lerpAngle } from './interpolate';
import { type Snapshot, type TransformRing, isContinuous } from './ring';

export interface ViewConfig {
  /** Kutu kenarinin yaricapa orani. 1 = kenar cap kadar. */
  readonly sizeScale: number;
}

export const DEFAULT_VIEW_CONFIG: ViewConfig = { sizeScale: 1 };

function readI32(array: Int32Array, index: number): number {
  const value = array[index];
  return value === undefined ? 0 : value;
}

/** Q16.16 ham degeri dunya birimine cevirir. */
function toWorld(array: Int32Array, index: number): number {
  return Fx.toFloat(Fx.raw(readI32(array, index)));
}

function toUnitColor(color: readonly [number, number, number]): [number, number, number] {
  return [color[0] / 255, color[1] / 255, color[2] / 255];
}

/**
 * Kare basina cizim kumelerini uretir.
 *
 * Matris tamponlari kareler arasinda yeniden kullanilir: her karede yeni
 * `Float32Array` ayirmak 60 Hz'de cop toplayiciyi bosuna calistirirdi.
 */
export class ViewBuilder {
  private readonly buffers: Float32Array[] = [];
  private readonly colors: [number, number, number][] = [];
  private readonly batches: InstanceBatch[] = [];

  constructor(private readonly config: ViewConfig = DEFAULT_VIEW_CONFIG) {}

  /**
   * @param ring Son iki tick'in anlik goruntuleri.
   * @param content Donmus icerik; yaricap ve renk buradan okunur.
   * @param alpha Tick'ler arasi karisim carpani, [0, 1].
   */
  build(ring: TransformRing, content: Content, alpha: number): readonly InstanceBatch[] {
    const current = ring.current;
    const previous = ring.previous;
    const factionCount = content.factions.length;

    this.ensureFactions(content);
    const counts = new Array<number>(factionCount).fill(0);

    for (let slot = 0; slot < current.highWater; slot++) {
      if (current.alive[slot] !== 1) continue;

      const type = content.unitTypes[readI32(current.unitType, slot)];
      if (type === undefined) continue;

      const faction = type.faction;
      if (faction < 0 || faction >= factionCount) continue;

      const placement = placeEntity(previous, current, slot, alpha);
      const size = Fx.toFloat(type.radius) * 2 * this.config.sizeScale;

      const index = counts[faction] ?? 0;
      const buffer = this.bufferFor(faction, index + 1);
      writeInstanceMatrix(buffer, index, placement.x, size / 2, placement.z, size, placement.yaw);
      counts[faction] = index + 1;
    }

    for (let faction = 0; faction < factionCount; faction++) {
      this.batches[faction] = {
        color: this.colors[faction] ?? [1, 1, 1],
        count: counts[faction] ?? 0,
        matrices: this.buffers[faction] ?? new Float32Array(0),
      };
    }
    this.batches.length = factionCount;
    return this.batches;
  }

  private ensureFactions(content: Content): void {
    for (let faction = 0; faction < content.factions.length; faction++) {
      if (this.buffers[faction] === undefined) {
        this.buffers[faction] = new Float32Array(MATRIX_STRIDE * 16);
      }
      const definition = content.factions[faction];
      if (definition !== undefined) {
        this.colors[faction] = toUnitColor(definition.color);
      }
    }
  }

  /** Kume tamponunu en az `count` ornege yetecek kadar buyutur. */
  private bufferFor(faction: number, count: number): Float32Array {
    const existing = this.buffers[faction] ?? new Float32Array(MATRIX_STRIDE * 16);
    const needed = count * MATRIX_STRIDE;
    if (existing.length >= needed) {
      this.buffers[faction] = existing;
      return existing;
    }
    let length = existing.length === 0 ? MATRIX_STRIDE * 16 : existing.length;
    while (length < needed) length = length * 2;
    const grown = new Float32Array(length);
    grown.set(existing);
    this.buffers[faction] = grown;
    return grown;
  }
}

/** Bir slotun bu karedeki gorsel yerlesimi. */
export interface Placement {
  readonly x: number;
  readonly z: number;
  /** Y ekseni etrafinda donus, radyan. */
  readonly yaw: number;
}

/**
 * Bir slotun iki anlik goruntu arasindaki yerlesimini hesaplar.
 *
 * Sim'in XY duzlemi sahnenin XZ duzlemine esler: sim'in Y'si sahnenin Z'sidir.
 * Slot sureklilik tasimiyorsa (yeni dogmus ya da geri donusturulmus) karisim
 * yapilmaz, en son konum kullanilir — aksi halde varlik ekranda isinlanir.
 */
export function placeEntity(
  previous: Snapshot,
  current: Snapshot,
  slot: number,
  alpha: number,
): Placement {
  const currentX = toWorld(current.posX, slot);
  const currentZ = toWorld(current.posY, slot);
  const currentFacing = readI32(current.facing, slot);

  if (!isContinuous(previous, current, slot)) {
    return { x: currentX, z: currentZ, yaw: bamToRadians(currentFacing) };
  }

  return {
    x: lerp(toWorld(previous.posX, slot), currentX, alpha),
    z: lerp(toWorld(previous.posY, slot), currentZ, alpha),
    yaw: bamToRadians(lerpAngle(readI32(previous.facing, slot), currentFacing, alpha)),
  };
}
