/**
 * Asama 6 — validate: sema kontrolu.
 *
 * İLK HATADA DURMAZ. Tum varliklar dogrulanir ve butun hatalar toplanir.
 * Her hatanin dosyasi, satiri ve modu alan bazinda kokenden okunur; boylece
 * bir alani yamalayan mod, tanimi yapan modla karistirilmaz.
 */
import {
  type ContentIssue,
  type FactionData,
  FactionSchema,
  SLUG_PATTERN,
  type UnitData,
  UnitSchema,
  toIssues,
} from '@bfme/schema';
import type * as z from 'zod';
import { type Origin, originOf } from './merge';

/** Dogrulanmis, anahtarina gore siralanmis varlik. */
export interface ValidatedEntity<T> {
  readonly key: string;
  readonly data: T;
  readonly origin: Origin | undefined;
}

export interface ValidateResult {
  readonly units: readonly ValidatedEntity<UnitData>[];
  readonly factions: readonly ValidatedEntity<FactionData>[];
  /**
   * Tanimli olup semayi GECEMEYEN birim anahtarlari.
   *
   * `link` bunlari bilmek zorundadir: bir birim dogrulamada elendiginde
   * kadrosundaki referans da cozulemez hale gelir. O referansi ayrica hata
   * saymak, sagliki olan fraksiyon dosyasini ve onun modunu haksiz yere
   * sucluyordu.
   */
  readonly rejectedUnits: ReadonlySet<string>;
  /** Tanimli olup semayi gecemeyen fraksiyon anahtarlari. */
  readonly rejectedFactions: ReadonlySet<string>;
  readonly issues: readonly ContentIssue[];
}

const UNIT_KIND = 'unit';
const FACTION_KIND = 'faction';
const KNOWN_KINDS = [FACTION_KIND, UNIT_KIND];

function isTable(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const UNKNOWN_ORIGIN: Origin = { file: '<bilinmiyor>', mod: '<bilinmiyor>', line: 0 };

/**
 * Birlestirilmis agaci dogrular.
 *
 * @param data `merge` ciktisi.
 * @param origins Alan bazli koken haritasi.
 */
export function validate(
  data: Readonly<Record<string, unknown>>,
  origins: ReadonlyMap<string, Origin>,
): ValidateResult {
  const issues: ContentIssue[] = [];

  for (const kind of Object.keys(data).sort()) {
    if (KNOWN_KINDS.includes(kind)) continue;
    const origin = originOf(origins, [kind]) ?? UNKNOWN_ORIGIN;
    issues.push({
      file: origin.file,
      line: origin.line,
      path: kind,
      expected: `bilinen bir tur: ${KNOWN_KINDS.join(', ')}`,
      got: `"${kind}"`,
      mod: origin.mod,
      message: 'Tanimsiz icerik turu.',
    });
  }

  const rejectedUnits = new Set<string>();
  const rejectedFactions = new Set<string>();
  const units = validateKind(data, origins, UNIT_KIND, UnitSchema, issues, rejectedUnits);
  const factions = validateKind(
    data,
    origins,
    FACTION_KIND,
    FactionSchema,
    issues,
    rejectedFactions,
  );
  return { units, factions, rejectedUnits, rejectedFactions, issues };
}

/** Bir tur altindaki tum varliklari dogrular; hatalari `issues` icine ekler. */
function validateKind<S extends z.ZodType>(
  data: Readonly<Record<string, unknown>>,
  origins: ReadonlyMap<string, Origin>,
  kind: string,
  schema: S,
  issues: ContentIssue[],
  rejected: Set<string>,
): ValidatedEntity<z.infer<S>>[] {
  const table = data[kind];
  if (table === undefined) return [];

  if (!isTable(table)) {
    const origin = originOf(origins, [kind]) ?? UNKNOWN_ORIGIN;
    issues.push({
      file: origin.file,
      line: origin.line,
      path: kind,
      expected: 'tablo',
      got: Array.isArray(table) ? 'dizi' : typeof table,
      mod: origin.mod,
      message: `"${kind}" bir tablo olmali.`,
    });
    return [];
  }

  const out: ValidatedEntity<z.infer<S>>[] = [];
  for (const key of Object.keys(table).sort()) {
    const entityOrigin = originOf(origins, [kind, key]) ?? UNKNOWN_ORIGIN;

    if (!SLUG_PATTERN.test(key)) {
      issues.push({
        file: entityOrigin.file,
        line: entityOrigin.line,
        path: `${kind}.${key}`,
        expected: `kimlik bicimi ${SLUG_PATTERN.source}`,
        got: `"${key}"`,
        mod: entityOrigin.mod,
        message: 'Gecersiz kimlik.',
      });
      rejected.add(key);
      continue;
    }

    const raw = table[key];
    const result = schema.safeParse(raw);
    if (result.success) {
      out.push({ key, data: result.data, origin: originOf(origins, [kind, key]) });
      continue;
    }

    rejected.add(key);
    const parsed = toIssues(result.error, raw, {
      file: entityOrigin.file,
      mod: entityOrigin.mod,
      prefix: [kind, key],
      lineOf: (p) => originOf(origins, p)?.line ?? entityOrigin.line,
    });

    // Her hatayi kendi alaninin kokenine baglar: bir alani yamalayan mod,
    // varligi tanimlayan modla karistirilmaz.
    for (const issue of parsed) {
      const fieldOrigin = originOf(origins, issue.path.split('.'));
      issues.push(
        fieldOrigin === undefined
          ? issue
          : { ...issue, file: fieldOrigin.file, mod: fieldOrigin.mod, line: fieldOrigin.line },
      );
    }
  }
  return out;
}
