/**
 * Sema hatalarinin insan tarafindan okunabilir, konumu belli hale getirilmesi.
 *
 * Yukleyici ilk hatada durmaz; tum hatalari toplar. Her hata hangi dosyada,
 * hangi satirda, hangi alanda, ne beklendigi, ne bulundugu ve hangi mod'un
 * yaptigi bilgisini tasir.
 */
import type * as z from 'zod';

/** Tek bir icerik hatasi. */
export interface ContentIssue {
  /** İcerik koku altindaki dosya yolu, orn. `base/units/soldier.toml`. */
  readonly file: string;
  /** 1 tabanli satir numarasi. Bilinmiyorsa 0. */
  readonly line: number;
  /** Nokta ile ayrilmis alan yolu, orn. `unit.soldier.speed`. */
  readonly path: string;
  /** Beklenen deger tarifi. */
  readonly expected: string;
  /** Bulunan deger tarifi. */
  readonly got: string;
  /** Hatayi yapan mod'un kimligi. */
  readonly mod: string;
  /** Kisa aciklama. */
  readonly message: string;
}

/** Hatalari konumlandirmak icin gereken baglam. */
export interface IssueContext {
  /** İcerik koku altindaki dosya yolu. */
  readonly file: string;
  /** Hatayi yapan mod'un kimligi. */
  readonly mod: string;
  /** Alan yolunun onune eklenecek parcalar, orn. `['unit', 'soldier']`. */
  readonly prefix?: readonly (string | number)[];
  /**
   * Alan yolundan 1 tabanli satir numarasi uretir. Bilinmiyorsa 0 dondurur.
   * TOML ayristiricisi satir haritasini bu fonksiyon araciligiyla saglar.
   */
  readonly lineOf?: (path: readonly (string | number)[]) => number;
}

/** Bir degeri kisa, deterministik bir metne cevirir. */
export function describeValue(value: unknown): string {
  if (value === undefined) return 'tanimsiz';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (Array.isArray(value)) return `${value.length} elemanli dizi`;
  if (value instanceof Date) return 'tarih';
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `tablo {${keys.join(', ')}}`;
  }
  return typeof value;
}

/** Nesne agacinda bir yoldaki degeri okur. Yol gecersizse `undefined`. */
export function valueAtPath(root: unknown, path: readonly PropertyKey[]): unknown {
  let cursor = root;
  for (const key of path) {
    if (cursor === null || cursor === undefined) return undefined;
    if (typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<PropertyKey, unknown>)[key];
  }
  return cursor;
}

function joinPath(parts: readonly (string | number)[]): string {
  return parts.length === 0 ? '<kok>' : parts.join('.');
}

/** Bir zod hatasindan "beklenen" tarifini uretir. */
function describeExpected(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.expected;
    case 'too_small':
      return `${issue.origin} ${issue.inclusive ? '>=' : '>'} ${String(issue.minimum)}`;
    case 'too_big':
      return `${issue.origin} ${issue.inclusive ? '<=' : '<'} ${String(issue.maximum)}`;
    case 'invalid_format':
      return issue.pattern === undefined ? issue.format : `${issue.format} ${issue.pattern}`;
    case 'invalid_value':
      return `su degerlerden biri: ${issue.values.map(describeValue).join(', ')}`;
    case 'unrecognized_keys':
      return 'bilinen bir alan';
    case 'invalid_union':
      return 'desteklenen varyantlardan biri';
    case 'invalid_element':
    case 'invalid_key':
      return 'gecerli anahtar/eleman';
    case 'not_multiple_of':
      return `${String(issue.divisor)} kati`;
    default:
      return issue.message;
  }
}

/** Bir zod hatasindan "bulunan" tarifini uretir. */
function describeGot(issue: z.core.$ZodIssue, input: unknown): string {
  if (issue.code === 'unrecognized_keys') {
    return `fazladan alan: ${issue.keys.join(', ')}`;
  }
  return describeValue(valueAtPath(input, issue.path));
}

/**
 * Bir `ZodError`'u `ContentIssue` listesine cevirir. Hatalarin sirasi zod'un
 * urettigi sira ile aynidir, yani ayni girdi her zaman ayni listeyi uretir.
 *
 * @param error Basarisiz `safeParse` sonucundaki hata.
 * @param input Ayristirilan ham deger; "bulunan" tarifini uretmek icin okunur.
 * @param ctx Dosya, mod ve satir bilgisi.
 */
export function toIssues(
  error: z.core.$ZodError,
  input: unknown,
  ctx: IssueContext,
): ContentIssue[] {
  const prefix = ctx.prefix ?? [];
  return error.issues.map((issue) => {
    const fullPath = [...prefix, ...issue.path.map((p) => (typeof p === 'symbol' ? '?' : p))];
    return {
      file: ctx.file,
      line: ctx.lineOf === undefined ? 0 : ctx.lineOf(fullPath),
      path: joinPath(fullPath),
      expected: describeExpected(issue),
      got: describeGot(issue, input),
      mod: ctx.mod,
      message: issue.message,
    };
  });
}

/** Tek bir hatayi tek satirlik metne cevirir. */
export function formatIssue(issue: ContentIssue): string {
  const where = issue.line > 0 ? `${issue.file}:${issue.line}` : issue.file;
  return `${where}  ${issue.path}\n  beklenen: ${issue.expected}\n  bulunan : ${issue.got}\n  mod     : ${issue.mod}`;
}

/** Hata listesini tek bir raporda toplar. */
export function formatIssues(issues: readonly ContentIssue[]): string {
  if (issues.length === 0) return 'hata yok';
  const head = `${issues.length} icerik hatasi:`;
  return [head, ...issues.map((i) => formatIssue(i))].join('\n\n');
}

/** Toplanmis icerik hatalarini tasiyan istisna. */
export class ContentError extends Error {
  readonly issues: readonly ContentIssue[];

  constructor(issues: readonly ContentIssue[]) {
    super(formatIssues(issues));
    this.name = 'ContentError';
    this.issues = issues;
  }
}
