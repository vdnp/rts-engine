/**
 * Asama 5 — merge: paketleri yukleme sirasinda tek bir agacta birlestir.
 *
 * Uc sozdizimi desteklenir:
 *
 * - `[unit.x]`            tam tanim. Varsa oncekini TAMAMEN degistirir.
 * - `[patch.unit.x]`      alan bazli yama. Sadece yazilan alanlari degistirir.
 * - `[append.faction.y]`  liste ekleme. `units = [...]` mevcut listeye eklenir.
 *
 * TOML'da bir tablo basligi liste olamayacagi icin ekleme her zaman hedefin
 * BİR UST tablosuyla yazilir; yol (`faction.y.units`) yine ayni.
 *
 * Bir dosyanin icinde sira sabittir: once tam tanimlar, sonra yamalar, en son
 * eklemeler. Boylece ayni dosyada hem tanimlayip hem yamalamak anlamlidir.
 *
 * Her yazilan dugum icin koken (hangi dosya, hangi mod, hangi satir) kaydedilir;
 * dogrulama hatalari boylece yamayi yapan modu ve satiri gosterebilir.
 */
import type { ContentIssue } from '@bfme/schema';
import type { ParsedFile } from './parse';

/** Bir degerin nereden geldigi. */
export interface Origin {
  readonly file: string;
  readonly mod: string;
  readonly line: number;
}

export interface MergeResult {
  /** Birlestirilmis ham agac: `{ unit: { x: {...} }, faction: {...} }`. */
  readonly data: Readonly<Record<string, unknown>>;
  /** Noktali birlesik yol -> koken. */
  readonly origins: ReadonlyMap<string, Origin>;
  readonly issues: readonly ContentIssue[];
}

type Table = Record<string, unknown>;

const PATCH_ROOT = 'patch';
const APPEND_ROOT = 'append';

function isTable(value: unknown): value is Table {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortedKeys(table: Table): string[] {
  return Object.keys(table).sort();
}

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone);
  if (isTable(value)) {
    const out: Table = {};
    for (const key of sortedKeys(value)) out[key] = clone(value[key]);
    return out;
  }
  return value;
}

/** Birlesik agacta bir yolu tablo olarak hazirlar ve dondurur. */
function ensureTable(root: Table, path: readonly string[]): Table | undefined {
  let cursor = root;
  for (const key of path) {
    const next = cursor[key];
    if (next === undefined) {
      const created: Table = {};
      cursor[key] = created;
      cursor = created;
    } else if (isTable(next)) {
      cursor = next;
    } else {
      return undefined;
    }
  }
  return cursor;
}

/** Birlesik agacta bir yoldaki degeri okur. */
function valueAt(root: Table, path: readonly string[]): unknown {
  let cursor: unknown = root;
  for (const key of path) {
    if (!isTable(cursor)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

class Merger {
  readonly data: Table = {};
  readonly origins = new Map<string, Origin>();
  readonly issues: ContentIssue[] = [];

  /** Bir dugum ve altindaki her sey icin koken kaydeder. */
  private recordOrigins(
    mergedPath: readonly string[],
    localPath: readonly string[],
    value: unknown,
    file: ParsedFile,
  ): void {
    this.origins.set(mergedPath.join('.'), {
      file: file.file,
      mod: file.mod,
      line: file.lines.lineOf(localPath),
    });
    if (isTable(value)) {
      for (const key of sortedKeys(value)) {
        this.recordOrigins([...mergedPath, key], [...localPath, key], value[key], file);
      }
    }
  }

  private issue(
    file: ParsedFile,
    localPath: readonly string[],
    expected: string,
    got: string,
    message: string,
    /** Satir numarasi icin kullanilacak yol; verilmezse `localPath`. */
    linePath: readonly string[] = localPath,
  ): void {
    this.issues.push({
      file: file.file,
      line: file.lines.lineOf(linePath),
      path: localPath.join('.'),
      expected,
      got,
      mod: file.mod,
      message,
    });
  }

  /** `[unit.x]` — tam tanim; oncekini tamamen degistirir. */
  private applyDirect(file: ParsedFile): void {
    for (const kind of sortedKeys(file.data)) {
      if (kind === PATCH_ROOT || kind === APPEND_ROOT) continue;
      const entries = file.data[kind];
      if (!isTable(entries)) {
        this.issue(file, [kind], 'tablo', describeShape(entries), `"${kind}" bir tablo olmali.`);
        continue;
      }
      const target = ensureTable(this.data, [kind]);
      if (target === undefined) continue;
      for (const id of sortedKeys(entries)) {
        target[id] = clone(entries[id]);
        this.recordOrigins([kind, id], [kind, id], entries[id], file);
      }
    }
  }

  /** `[patch.unit.x]` — alan bazli yama. */
  private applyPatch(file: ParsedFile): void {
    const root = file.data[PATCH_ROOT];
    if (root === undefined) return;
    if (!isTable(root)) {
      this.issue(file, [PATCH_ROOT], 'tablo', describeShape(root), 'patch bir tablo olmali.');
      return;
    }
    this.walkLeaves(root, [], (mergedPath, localTail, value) => {
      if (!this.targetExists(file, mergedPath, [PATCH_ROOT, ...localTail], 'yamalanacak')) return;
      const parent = ensureTable(this.data, mergedPath.slice(0, -1));
      const key = mergedPath[mergedPath.length - 1];
      if (parent === undefined || key === undefined) return;
      parent[key] = clone(value);
      this.recordOrigins(mergedPath, [PATCH_ROOT, ...localTail], value, file);
    });
  }

  /** `[append.faction.y]` + `units = [...]` — listeye ekleme. */
  private applyAppend(file: ParsedFile): void {
    const root = file.data[APPEND_ROOT];
    if (root === undefined) return;
    if (!isTable(root)) {
      this.issue(file, [APPEND_ROOT], 'tablo', describeShape(root), 'append bir tablo olmali.');
      return;
    }
    this.walkLeaves(root, [], (mergedPath, localTail, value) => {
      const local = [APPEND_ROOT, ...localTail];
      if (!Array.isArray(value)) {
        this.issue(file, local, 'dizi', describeShape(value), 'append yalnizca listeye eklenir.');
        return;
      }
      if (!this.targetExists(file, mergedPath, local, 'eklenecek')) return;

      const parent = ensureTable(this.data, mergedPath.slice(0, -1));
      const key = mergedPath[mergedPath.length - 1];
      if (parent === undefined || key === undefined) return;

      const existing = parent[key];
      if (existing === undefined) {
        parent[key] = clone(value);
      } else if (Array.isArray(existing)) {
        // `Array.isArray` unknown'i any[]'e daraltir; unknown[] olarak sabitle.
        const head = existing as unknown[];
        parent[key] = [...head, ...(clone(value) as unknown[])];
      } else {
        this.issue(
          file,
          local,
          'dizi alan',
          describeShape(existing),
          'Hedef alan bir liste degil.',
        );
        return;
      }
      this.recordOrigins(mergedPath, local, value, file);
    });
  }

  /**
   * Yamanin/eklemenin hedefledigi varligin (`kind.id`) tanimli olup olmadigini
   * dogrular. Var olmayan bir seyi yamalamak neredeyse her zaman yazim hatasidir.
   */
  private targetExists(
    file: ParsedFile,
    mergedPath: readonly string[],
    localPath: readonly string[],
    verb: string,
  ): boolean {
    if (mergedPath.length < 3) {
      this.issue(
        file,
        localPath,
        'en az `tur.kimlik.alan` derinliginde yol',
        mergedPath.join('.'),
        'Yol cok sig.',
      );
      return false;
    }
    const entity = mergedPath.slice(0, 2);
    if (isTable(valueAt(this.data, entity))) return true;
    // Satir, eksik varligi ADLANDIRAN tablo basligini gostermeli
    // (`[patch.unit.x]`), onun altindaki alani degil.
    this.issue(
      file,
      localPath,
      `tanimli "${entity.join('.')}"`,
      'tanimsiz',
      `${verb} varlik bulunamadi.`,
      localPath.slice(0, 3),
    );
    return false;
  }

  /** `patch`/`append` agacini gezip yaprak degerlere ulasir. */
  private walkLeaves(
    node: Table,
    path: readonly string[],
    visit: (mergedPath: string[], localTail: string[], value: unknown) => void,
  ): void {
    for (const key of sortedKeys(node)) {
      const value = node[key];
      const next = [...path, key];
      if (isTable(value)) {
        this.walkLeaves(value, next, visit);
      } else {
        visit([...next], [...next], value);
      }
    }
  }

  apply(file: ParsedFile): void {
    this.applyDirect(file);
    this.applyPatch(file);
    this.applyAppend(file);
  }
}

function describeShape(value: unknown): string {
  if (value === undefined) return 'tanimsiz';
  if (Array.isArray(value)) return 'dizi';
  if (isTable(value)) return 'tablo';
  return typeof value;
}

/**
 * Ayristirilmis dosyalari yukleme sirasinda birlestirir.
 *
 * @param files Sirali dosyalar. Sira onemlidir: sonraki dosya onceki tanimi ezer.
 */
export function merge(files: readonly ParsedFile[]): MergeResult {
  const merger = new Merger();
  for (const file of files) merger.apply(file);
  return { data: merger.data, origins: merger.origins, issues: merger.issues };
}

/** Bir yolun kokenini bulur; tam eslesme yoksa ust yollara cikar. */
export function originOf(
  origins: ReadonlyMap<string, Origin>,
  path: readonly (string | number)[],
): Origin | undefined {
  for (let end = path.length; end >= 0; end--) {
    const origin = origins.get(path.slice(0, end).join('.'));
    if (origin !== undefined) return origin;
  }
  return undefined;
}
