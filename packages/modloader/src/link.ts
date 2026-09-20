/**
 * Asama 7 — link: metin referanslarini sayisal kimliklere coz.
 *
 * Sayisal kimlik, varligin anahtarina gore siralanmis dizideki indekstir.
 * Siralama alfabetiktir, yani ayni icerik her zaman ayni kimlikleri uretir.
 *
 * Birim uyeligi TEK kaynaktan gelir: fraksiyonun kadro listesi. Bir birim tam
 * olarak bir kadroda gecmelidir; hicbirinde gecmemek de birden fazlasinda
 * gecmek de hatadir.
 *
 * Burada ayrica sayilar fixed-point'e cevrilir: bu, float degerlerin sim'e
 * girmeden once kirpildigi tek noktadir.
 */
import { Fx } from '@bfme/sim-math';
import type {
  AngularRate,
  ContentIssue,
  Faction,
  FactionId,
  UnitType,
  UnitTypeId,
} from '@bfme/schema';
import { type Origin, originOf } from './merge';
import type { ValidateResult } from './validate';

export interface LinkResult {
  readonly unitTypes: readonly UnitType[];
  readonly factions: readonly Faction[];
  readonly unitTypeByKey: Record<string, UnitTypeId>;
  readonly factionByKey: Record<string, FactionId>;
  readonly issues: readonly ContentIssue[];
}

const UNKNOWN_ORIGIN: Origin = { file: '<bilinmiyor>', mod: '<bilinmiyor>', line: 0 };
const BAM_PER_TURN = 65536;

/** Derece/saniye -> BAM/saniye. Yuvarlama yarim yukari. */
function toAngularRate(degreesPerSecond: number): AngularRate {
  return (((degreesPerSecond * BAM_PER_TURN) / 360 + 0.5) | 0) as AngularRate;
}

export function link(validated: ValidateResult, origins: ReadonlyMap<string, Origin>): LinkResult {
  const issues: ContentIssue[] = [];

  const unitTypeByKey: Record<string, UnitTypeId> = {};
  validated.units.forEach((entity, index) => {
    unitTypeByKey[entity.key] = index as UnitTypeId;
  });

  const factionByKey: Record<string, FactionId> = {};
  validated.factions.forEach((entity, index) => {
    factionByKey[entity.key] = index as FactionId;
  });

  /** Birim anahtari -> onu kadrosunda tasiyan fraksiyonun anahtari. */
  const owner = new Map<string, string>();
  const rosters: UnitTypeId[][] = [];

  validated.factions.forEach((faction, factionIndex) => {
    const roster: UnitTypeId[] = [];
    const seen = new Set<string>();

    for (const [slot, unitKey] of faction.data.units.entries()) {
      const path = ['faction', faction.key, 'units', slot];
      const origin = originOf(origins, path) ?? faction.origin ?? UNKNOWN_ORIGIN;
      const unitId = unitTypeByKey[unitKey];

      if (unitId === undefined) {
        issues.push(
          issueAt(
            origin,
            path,
            'tanimli bir birim kimligi',
            `"${unitKey}"`,
            'Cozulemeyen birim referansi.',
          ),
        );
        continue;
      }
      if (seen.has(unitKey)) {
        issues.push(
          issueAt(
            origin,
            path,
            'kadroda bir kez gecen birim',
            `"${unitKey}" tekrar ediyor`,
            'Ayni birim kadroda iki kez listelenmis.',
          ),
        );
        continue;
      }
      const existingOwner = owner.get(unitKey);
      if (existingOwner !== undefined) {
        issues.push(
          issueAt(
            origin,
            path,
            'tek bir fraksiyona ait birim',
            `"${unitKey}" zaten "${existingOwner}" kadrosunda`,
            'Bir birim yalnizca bir fraksiyonun kadrosunda olabilir.',
          ),
        );
        continue;
      }

      seen.add(unitKey);
      owner.set(unitKey, faction.key);
      roster.push(unitId);
    }

    rosters[factionIndex] = roster;
  });

  const unitTypes: UnitType[] = validated.units.map((entity, index) => {
    const factionKey = owner.get(entity.key);
    const factionId = factionKey === undefined ? undefined : factionByKey[factionKey];

    if (factionId === undefined) {
      const origin = entity.origin ?? UNKNOWN_ORIGIN;
      issues.push(
        issueAt(
          origin,
          ['unit', entity.key],
          'bir fraksiyonun kadrosunda gecmesi',
          'hicbir kadroda yok',
          'Her birim tam olarak bir fraksiyonun `units` listesinde gecmelidir.',
        ),
      );
    }

    return {
      id: index as UnitTypeId,
      key: entity.key,
      name: entity.data.name,
      faction: (factionId ?? 0) as FactionId,
      maxHealth: entity.data.maxHealth,
      speed: Fx.of(entity.data.speed),
      turnRate: toAngularRate(entity.data.turnRate),
      radius: Fx.of(entity.data.radius),
    };
  });

  const factions: Faction[] = validated.factions.map((entity, index) => ({
    id: index as FactionId,
    key: entity.key,
    name: entity.data.name,
    color: entity.data.color,
    unitTypes: rosters[index] ?? [],
  }));

  return { unitTypes, factions, unitTypeByKey, factionByKey, issues };
}

function issueAt(
  origin: Origin,
  path: readonly (string | number)[],
  expected: string,
  got: string,
  message: string,
): ContentIssue {
  return {
    file: origin.file,
    line: origin.line,
    path: path.join('.'),
    expected,
    got,
    mod: origin.mod,
    message,
  };
}
