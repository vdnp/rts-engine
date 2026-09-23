/**
 * Determinizm kosusu icin komut akisi.
 *
 * Amaci sim'i ZORLAMAKTIR: uygulamanin demo senaryosundan daha yogun dogum
 * ve daha sik hedef degisimi uretir, boylece 10.000 tick boyunca hareket,
 * yon cevirme ve kapasite buyutme yollari calisir. Uygulamadakiyle ayni
 * olmasi GEREKMEZ; o gorsel icin ayarlidir, bu dogrulama icin.
 *
 * Faz 0'da hicbir sey hasar vermedigi icin varliklar olmez; slot geri
 * donusumu bu kosuda calismaz. Savas geldiginde burasi genisletilecek.
 *
 * Tamamen deterministiktir: ayni tohum ayni komut akisini verir.
 */
import { type Command, NULL_ENTITY, type ReadonlySimState, entityAt } from '@bfme/core-sim';
import type { Content, UnitTypeId } from '@bfme/schema';
import { Rng } from '@bfme/sim-math';

/** Haritanin merkezden kenara uzakligi, dunya birimi. */
const MAP_EXTENT = 60;
/** Ayni anda yasayabilecek en fazla varlik. */
const MAX_ENTITIES = 256;
/** Kac tick'te bir dogum denenir. */
const SPAWN_EVERY = 3;
/** Kac tick'te bir hedefler yenilenir. */
const RETARGET_EVERY = 31;

export class Scenario {
  private rng: Rng;

  constructor(
    private readonly content: Content,
    private readonly seed: number,
  ) {
    this.rng = Rng.create(seed);
  }

  reset(): void {
    this.rng = Rng.create(this.seed);
  }

  next(state: ReadonlySimState): Command[] {
    const commands: Command[] = [];
    const typeCount = this.content.unitTypes.length;
    if (typeCount === 0) return commands;

    if (state.tick % SPAWN_EVERY === 0 && state.entityCount < MAX_ENTITIES) {
      const unitType = this.rng.nextInt(typeCount) as UnitTypeId;
      commands.push({
        kind: 'spawnUnit',
        unitType,
        owner: this.content.unitTypes[unitType]?.faction ?? 0,
        posX: this.coordinate(),
        posY: this.coordinate(),
        facing: this.rng.nextInt(65536),
      });
    }

    if (state.tick % RETARGET_EVERY === 0) {
      // Slot sirasi sabittir; komut sirasi bu yuzden deterministiktir.
      for (let slot = 0; slot < state.highWater; slot++) {
        const entity = entityAt(state, slot);
        if (entity === NULL_ENTITY) continue;
        commands.push({
          kind: 'moveOrder',
          entity,
          targetX: this.coordinate(),
          targetY: this.coordinate(),
        });
      }
    }

    return commands;
  }

  /** [-MAP_EXTENT, MAP_EXTENT] araliginda Q16.16 ham deger. */
  private coordinate(): number {
    const span = MAP_EXTENT * 2 * 65536;
    return this.rng.nextInt(span + 1) - MAP_EXTENT * 65536;
  }
}
