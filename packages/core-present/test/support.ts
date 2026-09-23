/**
 * Test icerigi ve kisayollari.
 *
 * İsimler bilerek uydurma: present de icerik bilmez.
 */
import type { AngularRate, Content, Faction, FactionId, UnitType, UnitTypeId } from '@bfme/schema';
import { Fx } from '@bfme/sim-math';

export interface UnitSpec {
  readonly key: string;
  readonly faction: number;
  readonly radius: number;
}

export interface FactionSpec {
  readonly key: string;
  readonly color: [number, number, number];
}

export const FACTIONS: readonly FactionSpec[] = [
  { key: 'alpha', color: [255, 0, 0] },
  { key: 'beta', color: [0, 128, 255] },
];

export const UNITS: readonly UnitSpec[] = [
  { key: 'walker', faction: 0, radius: 0.5 },
  { key: 'runner', faction: 0, radius: 0.25 },
  { key: 'guard', faction: 1, radius: 1 },
];

export function makeContent(
  units: readonly UnitSpec[] = UNITS,
  factions: readonly FactionSpec[] = FACTIONS,
): Content {
  const unitTypes: UnitType[] = units.map((spec, index) => ({
    id: index as UnitTypeId,
    key: spec.key,
    name: spec.key,
    faction: spec.faction as FactionId,
    maxHealth: 100,
    speed: Fx.of(6),
    turnRate: 5461 as AngularRate,
    radius: Fx.of(spec.radius),
  }));

  const built: Faction[] = factions.map((spec, index) => ({
    id: index as FactionId,
    key: spec.key,
    name: spec.key,
    color: spec.color,
    unitTypes: unitTypes.filter((u) => u.faction === index).map((u) => u.id),
  }));

  const unitTypeByKey: Record<string, UnitTypeId> = {};
  for (const unit of unitTypes) unitTypeByKey[unit.key] = unit.id;
  const factionByKey: Record<string, FactionId> = {};
  for (const faction of built) factionByKey[faction.key] = faction.id;

  return Object.freeze({
    dataHash: 0xabcdef12,
    mods: Object.freeze([{ id: 'test', name: 'Test', version: '1.0.0', order: 0 }]),
    unitTypes: Object.freeze(unitTypes),
    factions: Object.freeze(built),
    unitTypeByKey: Object.freeze(unitTypeByKey),
    factionByKey: Object.freeze(factionByKey),
  });
}

/** Dunya biriminden Q16.16 ham degere. */
export const w = (value: number): number => Fx.of(value);
