/**
 * İcerik denetleme islemleri.
 *
 * Bu dosya bicimlendirme yapmaz ve hicbir seyi yazdirmaz: `ContentSource`
 * alir, yapisal bir rapor dondurur. Metin ciktisi `report.ts` icinde, dosya
 * okuma CLI'da; boylece denetim mantigi dosya sistemi olmadan test edilir.
 *
 * Sim'e hic dokunulmaz — devctl icerigi DENETLER, calistirmaz.
 */
import {
  type ContentIssue,
  type ContentSource,
  discover,
  formatHash,
  loadContent,
  order,
  resolve,
} from '@bfme/modloader';

/** Bir icerik paketinin ozeti. */
export interface ModRow {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  /** Bagimliliklar, kimlige gore siralanmis. */
  readonly dependencies: readonly { readonly id: string; readonly range: string }[];
  /** Pakete ait `.toml` dosyasi sayisi (manifest haric). */
  readonly fileCount: number;
  /** Paket yuklenebilir durumda mi. */
  readonly ok: boolean;
}

export interface ModsReport {
  /** Bulunan paketler, kimlige gore siralanmis. */
  readonly packages: readonly ModRow[];
  /** Cozulen yukleme sirasi. */
  readonly loadOrder: readonly string[];
  readonly issues: readonly ContentIssue[];
}

/**
 * Paketleri bulur, bagimliliklari cozer ve yukleme sirasini hesaplar.
 *
 * Boru hattinin ilk uc asamasidir (discover, resolve, order); icerik
 * dosyalari ayristirilmaz, dolayisiyla buyuk mod kumelerinde de hizlidir.
 *
 * @param enabled Verilirse yalnizca bu paketler incelenir ve sira tercihi
 *   olarak kullanilir. Verilmezse bulunan her paket alinir.
 */
export function inspectMods(source: ContentSource, enabled?: readonly string[]): ModsReport {
  const discovered = discover(source, enabled);
  const resolved = resolve(discovered.packages);
  const ordered = order(resolved.packages, enabled ?? []);

  const issues = [...discovered.issues, ...resolved.issues, ...ordered.issues];
  const loadable = new Set(ordered.packages.map((pkg) => pkg.manifest.id));

  const packages: ModRow[] = discovered.packages
    .map((pkg) => ({
      id: pkg.manifest.id,
      name: pkg.manifest.name,
      version: pkg.manifest.version,
      dependencies: Object.keys(pkg.manifest.dependencies)
        .sort()
        .map((id) => ({ id, range: pkg.manifest.dependencies[id] ?? '*' })),
      fileCount: pkg.files.length,
      ok: loadable.has(pkg.manifest.id),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    packages,
    loadOrder: ordered.packages.map((pkg) => pkg.manifest.id),
    issues,
  };
}

/** Basariyla yuklenmis icerigin ozeti. */
export interface ContentSummary {
  /** `dataHash`, sekiz haneli onaltilik. */
  readonly dataHash: string;
  readonly mods: readonly { readonly id: string; readonly version: string }[];
  readonly unitTypeCount: number;
  readonly factionCount: number;
  /** Fraksiyon anahtari -> kadrosundaki birim sayisi. */
  readonly roster: readonly { readonly faction: string; readonly unitTypes: number }[];
}

export interface ValidateReport {
  readonly ok: boolean;
  /** Yukleme basarisizsa `undefined`. */
  readonly summary: ContentSummary | undefined;
  readonly issues: readonly ContentIssue[];
}

/**
 * Tam yukleme boru hattini kosar ve TUM hatalari toplar.
 *
 * İlk hatada durmaz: bir gecişte gorulebilecek her sorun raporlanir.
 */
export function inspectContent(source: ContentSource, mods: readonly string[]): ValidateReport {
  const result = loadContent(source, { enabled: [...mods] });
  if (!result.ok) {
    return { ok: false, summary: undefined, issues: result.issues };
  }

  const content = result.content;
  return {
    ok: true,
    summary: {
      dataHash: formatHash(content.dataHash),
      mods: content.mods.map((mod) => ({ id: mod.id, version: mod.version })),
      unitTypeCount: content.unitTypes.length,
      factionCount: content.factions.length,
      roster: content.factions.map((faction) => ({
        faction: faction.key,
        unitTypes: faction.unitTypes.length,
      })),
    },
    issues: [],
  };
}
