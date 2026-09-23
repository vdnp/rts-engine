/**
 * Faz 0 demo senaryosu.
 *
 * Ekranda bir seyin hareket etmesi icin komut uretir: belirli araliklarla
 * birim dogurur ve yasayan birimlere yeni hedefler verir. Tamamen
 * deterministiktir — ayni tohum ayni komut akisini verir.
 *
 * Bu bir OYUN KURALI DEGİLDİR; sim'e disaridan giren bir girdi kaynagidir.
 * Faz 5'te yerini skirmish AI ve gercek harita baslangic noktalari alacak.
 */
import { type Command, type ReadonlySimState, NULL_ENTITY, entityAt } from '@bfme/core-sim';
import type { Content, UnitTypeId } from '@bfme/schema';
import { Rng } from '@bfme/sim-math';

export interface ScenarioConfig {
  /** Deterministik tohum. */
  readonly seed: number;
  /** Ayni anda ekranda bulunabilecek en fazla birim. */
  readonly maxEntities: number;
  /** Kac tick'te bir birim dogar. */
  readonly spawnEveryTicks: number;
  /** Kac tick'te bir yeni hedefler verilir. */
  readonly retargetEveryTicks: number;
  /** Haritanin merkezden kenara uzakligi, dunya birimi. */
  readonly mapExtent: number;
}

export const DEFAULT_SCENARIO: Omit<ScenarioConfig, 'seed'> = {
  maxEntities: 64,
  spawnEveryTicks: 6,
  retargetEveryTicks: 45,
  mapExtent: 60,
};

export class Scenario {
  private rng: Rng;

  constructor(
    private readonly content: Content,
    private readonly config: ScenarioConfig,
  ) {
    this.rng = Rng.create(config.seed);
  }

  /** Tohumdan yeniden baslatir; ayni akis bastan uretilir. */
  reset(): void {
    this.rng = Rng.create(this.config.seed);
  }

  /** Bu tick'te sim'e gidecek komutlar. */
  next(state: ReadonlySimState): Command[] {
    const commands: Command[] = [];
    const typeCount = this.content.unitTypes.length;
    if (typeCount === 0) return commands;

    if (
      state.tick % this.config.spawnEveryTicks === 0 &&
      state.entityCount < this.config.maxEntities
    ) {
      const unitType = this.rng.nextInt(typeCount) as UnitTypeId;
      commands.push({
        kind: 'spawnUnit',
        unitType,
        owner: this.content.unitTypes[unitType]?.faction ?? 0,
        posX: this.randomCoordinate(),
        posY: this.randomCoordinate(),
        facing: this.rng.nextInt(65536),
      });
    }

    if (state.tick % this.config.retargetEveryTicks === 0) {
      // Slot sirasi sabittir; komut akisi bu yuzden deterministiktir.
      for (let slot = 0; slot < state.highWater; slot++) {
        const entity = entityAt(state, slot);
        if (entity === NULL_ENTITY) continue;
        commands.push({
          kind: 'moveOrder',
          entity,
          targetX: this.randomCoordinate(),
          targetY: this.randomCoordinate(),
        });
      }
    }

    return commands;
  }

  /** [-mapExtent, mapExtent] araliginda Q16.16 ham deger. */
  private randomCoordinate(): number {
    const span = this.config.mapExtent * 2 * 65536;
    return this.rng.nextInt(span + 1) - this.config.mapExtent * 65536;
  }
}
