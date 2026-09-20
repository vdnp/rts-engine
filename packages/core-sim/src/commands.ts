/**
 * Simulasyona giren tek veri yolu: komutlar.
 *
 * Komutlar dizideki SIRAYLA islenir; sira determinizmin parcasidir.
 * Gecersiz bir komut (bayat tanitici, tanimsiz birim tipi) sessizce atlanir ve
 * ASLA istisna firlatmaz: lockstep'te tek bir bozuk komut butun oyunculari
 * dusuremez, ama hepsinde ayni sekilde etkisiz kalmalidir.
 */
import type { Content, UnitTypeId } from '@bfme/schema';
import type { Entity } from './entity';
import { type SimState, isAlive, readI32, spawn } from './state';

/** Birim yaratma komutu. */
export interface SpawnUnitCommand {
  readonly kind: 'spawnUnit';
  readonly unitType: UnitTypeId;
  /** Oyuncu numarasi. */
  readonly owner: number;
  /** Baslangic konumu, Q16.16. */
  readonly posX: number;
  readonly posY: number;
  /** Baslangic yonu, BAM16. */
  readonly facing: number;
}

/** Hareket emri. */
export interface MoveOrderCommand {
  readonly kind: 'moveOrder';
  readonly entity: Entity;
  /** Hedef konum, Q16.16. */
  readonly targetX: number;
  readonly targetY: number;
}

export type Command = SpawnUnitCommand | MoveOrderCommand;

/** Tum komutlari sirayla uygular. */
export function applyCommands(
  state: SimState,
  commands: readonly Command[],
  content: Content,
): void {
  for (const command of commands) {
    switch (command.kind) {
      case 'spawnUnit':
        applySpawn(state, command, content);
        break;
      case 'moveOrder':
        applyMoveOrder(state, command);
        break;
    }
  }
}

function applySpawn(state: SimState, command: SpawnUnitCommand, content: Content): void {
  const type = content.unitTypes[command.unitType];
  if (type === undefined) return;
  spawn(state, {
    unitType: command.unitType,
    owner: command.owner | 0,
    posX: command.posX | 0,
    posY: command.posY | 0,
    facing: command.facing & 0xffff,
    maxHealth: type.maxHealth | 0,
  });
}

function applyMoveOrder(state: SimState, command: MoveOrderCommand): void {
  if (!isAlive(state, command.entity)) return;
  const slot = command.entity & 0xfffff;
  state.targetX[slot] = command.targetX | 0;
  state.targetY[slot] = command.targetY | 0;
  // Hedef zaten ayaklarinin altindaysa hareket baslatma.
  const atTarget =
    readI32(state.posX, slot) === (command.targetX | 0) &&
    readI32(state.posY, slot) === (command.targetY | 0);
  state.moving[slot] = atTarget ? 0 : 1;
}
