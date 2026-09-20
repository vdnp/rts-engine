/**
 * @bfme/core-sim — deterministik RTS simulasyonu.
 *
 * Bu paket saftir: `Math`, `Date`, zamanlayici, DOM, G/C ve float aritmetik
 * yoktur. Kurallar `eslint.config.js` tarafindan zorlanir.
 */
export { DEFAULT_CAPACITY, TICK_RATE } from './constants';

export { MAX_SLOTS, NULL_ENTITY, entityGeneration, entitySlot, makeEntity } from './entity';
export type { Entity } from './entity';

export {
  I32_FIELDS,
  U8_FIELDS,
  createSimState,
  destroy,
  entityAt,
  grow,
  isAlive,
  readI32,
  readU8,
  spawn,
} from './state';
export type {
  I32Field,
  ReadonlyI32Array,
  ReadonlySimState,
  ReadonlyU8Array,
  SimState,
  SpawnParams,
  U8Field,
} from './state';

export { applyCommands } from './commands';
export type { Command, MoveOrderCommand, SpawnUnitCommand } from './commands';

export { movementSystem, shortestTurn, turnToward } from './systems/movement';
export { healthSystem } from './systems/health';

export { formatStateHash, hashState } from './hash';
export { tick } from './tick';
