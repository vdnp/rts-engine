/**
 * Asama 1 — discover: icerik kokunun altindaki `manifest.toml` dosyalarini bul.
 *
 * Vanilla icerik ozel muamele gormez. `content/base/` de digerleri gibi bir
 * pakettir; sadece etkin mod listesinde ilk sirada gelir.
 */
import { type ContentIssue, ManifestSchema, type Manifest, toIssues } from '@bfme/schema';
import type { LineMap } from './linemap';
import { parseFile } from './parse';
import type { ContentSource } from './source';

/** Bulunmus ve manifesti dogrulanmis bir icerik paketi. */
export interface DiscoveredPackage {
  /** Paketin dizin adi, orn. `base`. */
  readonly dir: string;
  /** Dogrulanmis manifest. */
  readonly manifest: Manifest;
  /** Manifest dosyasinin satir haritasi; hata mesajlari icin. */
  readonly lines: LineMap;
  /** Paketteki diger `.toml` dosyalari, yola gore siralanmis. */
  readonly files: readonly string[];
}

export interface DiscoverResult {
  readonly packages: readonly DiscoveredPackage[];
  readonly issues: readonly ContentIssue[];
}

const MANIFEST_PATTERN = /^([^/]+)\/manifest\.toml$/;

/**
 * Kaynaktaki paketleri bulur ve manifestlerini dogrular.
 *
 * @param source Dosya kaynagi.
 * @param enabled Verilirse yalnizca bu dizinler yuklenir ve listede olup
 *   bulunamayan her paket bir hata uretir. Verilmezse bulunan her paket alinir.
 */
export function discover(source: ContentSource, enabled?: readonly string[]): DiscoverResult {
  const paths = [...source.list()].sort();
  const issues: ContentIssue[] = [];
  const packages: DiscoveredPackage[] = [];
  const found = new Set<string>();

  for (const path of paths) {
    const match = MANIFEST_PATTERN.exec(path);
    if (match === null) continue;
    const dir = match[1] ?? '';
    if (enabled !== undefined && !enabled.includes(dir)) continue;
    found.add(dir);

    const text = source.read(path);
    if (text === undefined) {
      issues.push(missing(path, dir, 'okunabilir dosya', 'okunamadi'));
      continue;
    }

    const parsed = parseFile(path, dir, text);
    issues.push(...parsed.issues);
    if (parsed.file === undefined) continue;

    const result = ManifestSchema.safeParse(parsed.file.data);
    if (!result.success) {
      issues.push(
        ...toIssues(result.error, parsed.file.data, {
          file: path,
          mod: dir,
          lineOf: (p) => parsed.file?.lines.lineOf(p) ?? 0,
        }),
      );
      continue;
    }

    if (result.data.id !== dir) {
      issues.push({
        file: path,
        line: parsed.file.lines.lineOf(['id']),
        path: 'id',
        expected: `dizin adiyla ayni kimlik: "${dir}"`,
        got: `"${result.data.id}"`,
        mod: dir,
        message: 'Paket kimligi dizin adiyla ayni olmalidir.',
      });
      continue;
    }

    packages.push({
      dir,
      manifest: result.data,
      lines: parsed.file.lines,
      files: paths.filter((p) => p !== path && p.startsWith(`${dir}/`) && p.endsWith('.toml')),
    });
  }

  if (enabled !== undefined) {
    for (const dir of enabled) {
      if (found.has(dir)) continue;
      issues.push(missing(`${dir}/manifest.toml`, dir, 'var olan icerik paketi', 'bulunamadi'));
    }
  }

  return { packages, issues };
}

function missing(file: string, mod: string, expected: string, got: string): ContentIssue {
  return {
    file,
    line: 0,
    path: '<paket>',
    expected,
    got,
    mod,
    message: `İcerik paketi yuklenemedi: ${mod}`,
  };
}
