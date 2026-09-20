/**
 * Test icerigi.
 *
 * core-sim modloader'i import edemez (katman kurali), bu yuzden test icerigi
 * elle kurulur. Bu ayni zamanda sim'in gercekten icerikten bagimsiz oldugunu
 * gosterir: isimler tamamen uydurma.
 */
import type { AngularRate, Content, Faction, FactionId, UnitType, UnitTypeId } from '@bfme/schema';
import { Fx } from '@bfme/sim-math';

/** Derece/saniye -> BAM/saniye. */
export function degreesPerSecond(value: number): AngularRate {
  return Math.round((value * 65536) / 360) as AngularRate;
}

export interface UnitSpec {
  readonly key: string;
  readonly maxHealth: number;
  /** Dunya birimi / saniye. */
  readonly speed: number;
  /** Derece / saniye. */
  readonly turnRate: number;
  readonly radius: number;
}

export const DEFAULT_UNITS: readonly UnitSpec[] = [
  { key: 'walker', maxHealth: 100, speed: 6, turnRate: 360, radius: 0.5 },
  { key: 'runner', maxHealth: 60, speed: 12, turnRate: 720, radius: 0.4 },
  { key: 'statue', maxHealth: 500, speed: 0, turnRate: 90, radius: 1 },
];

/** Verilen birim tanimlarindan donmus bir `Content` kurar. */
export function makeContent(units: readonly UnitSpec[] = DEFAULT_UNITS): Content {
  const unitTypes: UnitType[] = units.map((spec, index) => ({
    id: index as UnitTypeId,
    key: spec.key,
    name: spec.key,
    faction: 0 as FactionId,
    maxHealth: spec.maxHealth,
    speed: Fx.of(spec.speed),
    turnRate: degreesPerSecond(spec.turnRate),
    radius: Fx.of(spec.radius),
  }));

  const factions: Faction[] = [
    {
      id: 0 as FactionId,
      key: 'test',
      name: 'Test',
      color: [255, 255, 255],
      unitTypes: unitTypes.map((u) => u.id),
    },
  ];

  const unitTypeByKey: Record<string, UnitTypeId> = {};
  for (const unit of unitTypes) unitTypeByKey[unit.key] = unit.id;

  return Object.freeze({
    dataHash: 0x12345678,
    mods: Object.freeze([{ id: 'test', name: 'Test', version: '1.0.0', order: 0 }]),
    unitTypes: Object.freeze(unitTypes),
    factions: Object.freeze(factions),
    unitTypeByKey: Object.freeze(unitTypeByKey),
    factionByKey: Object.freeze({ test: 0 as FactionId }),
  });
}

/** Kisa yazim: dunya biriminden Q16.16. */
export const w = (value: number): number => Fx.of(value);

/** Q16.16'dan dunya birimine (yalnizca testlerde okunabilirlik icin). */
export const toWorld = (value: number): number => value / 65536;
