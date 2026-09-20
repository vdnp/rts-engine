/**
 * Surum karsilastirma ve aralik kontrolu.
 *
 * Desteklenen bicim yalnizca `MAJOR.MINOR.PATCH`'tir; on-surum etiketi
 * (`-beta`) ve yapilandirma verisi (`+build`) yoktur. Aralik dilbilgisi
 * `@bfme/schema` icindeki `VERSION_RANGE_PATTERN` ile ayni.
 */

/** Ayristirilmis surum. */
export interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** `1.2.3` metnini ayristirir. Bicim bozuksa `undefined`. */
export function parseVersion(text: string): Version | undefined {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (m === null) return undefined;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** `a` < `b` ise -1, esitse 0, buyukse 1. */
export function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

/**
 * Bir surumun verilen araligi karsilayip karsilamadigi.
 *
 * - `*` her surumu kabul eder
 * - `1.2.3` ve `=1.2.3` tam esitlik ister
 * - `>1.2.3`, `>=1.2.3`, `<1.2.3`, `<=1.2.3` karsilastirma
 * - `^1.2.3` en az 1.2.3, ayni major icinde. Major 0 ise ayni minor icinde
 *   (0.x surumlerinde her minor kirici kabul edilir).
 * - `~1.2.3` en az 1.2.3, ayni major.minor icinde
 *
 * Bicimi taninmayan aralik `false` dondurur; bicim dogrulamasi semanin isidir.
 */
export function satisfies(version: string, range: string): boolean {
  const v = parseVersion(version);
  if (v === undefined) return false;
  if (range === '*') return true;

  const m = /^(=|>=|<=|>|<|\^|~)?(\d+\.\d+\.\d+)$/.exec(range);
  if (m === null) return false;
  const operator = m[1] ?? '=';
  const target = parseVersion(m[2] ?? '');
  if (target === undefined) return false;

  const cmp = compareVersions(v, target);
  switch (operator) {
    case '=':
      return cmp === 0;
    case '>':
      return cmp > 0;
    case '>=':
      return cmp >= 0;
    case '<':
      return cmp < 0;
    case '<=':
      return cmp <= 0;
    case '^':
      if (cmp < 0) return false;
      return target.major === 0
        ? v.major === 0 && v.minor === target.minor
        : v.major === target.major;
    case '~':
      return cmp >= 0 && v.major === target.major && v.minor === target.minor;
    default:
      return false;
  }
}
