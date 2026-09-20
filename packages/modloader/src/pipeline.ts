/**
 * Sekiz asamali icerik yukleme boru hatti.
 *
 *   discover -> resolve -> order -> parse -> merge -> validate -> link -> freeze
 *
 * Asamalar hata bulsa bile calismaya devam eder; amac tek gecişte mumkun olan
 * en cok hatayi raporlamaktir. Herhangi bir hata varsa sonuc basarisizdir ve
 * icerik uretilmez.
 */
import type { Content, ContentIssue, ModInfo } from '@bfme/schema';
import { discover } from './discover';
import { freeze } from './freeze';
import { link } from './link';
import { merge } from './merge';
import { order } from './order';
import { parseFile, type ParsedFile } from './parse';
import { resolve } from './resolve';
import type { ContentSource } from './source';
import { validate } from './validate';

export interface LoadOptions {
  /**
   * Yuklenecek paketler, yukleme sirasinda. Verilmezse kaynakta bulunan tum
   * paketler alfabetik sirayla alinir. Listede olup bulunamayan paket hatadir.
   */
  readonly enabled?: readonly string[];
}

export type LoadResult =
  | { readonly ok: true; readonly content: Content }
  | { readonly ok: false; readonly issues: readonly ContentIssue[] };

/** Kaynaktaki icerigi yukler, dogrular, baglar ve dondurur. */
export function loadContent(source: ContentSource, options: LoadOptions = {}): LoadResult {
  const issues: ContentIssue[] = [];

  const discovered = discover(source, options.enabled);
  issues.push(...discovered.issues);

  const resolved = resolve(discovered.packages);
  issues.push(...resolved.issues);

  const ordered = order(resolved.packages, options.enabled ?? []);
  issues.push(...ordered.issues);

  const parsed: ParsedFile[] = [];
  for (const pkg of ordered.packages) {
    for (const path of pkg.files) {
      const text = source.read(path);
      if (text === undefined) continue;
      const result = parseFile(path, pkg.dir, text);
      issues.push(...result.issues);
      if (result.file !== undefined) parsed.push(result.file);
    }
  }

  const merged = merge(parsed);
  issues.push(...merged.issues);

  const validated = validate(merged.data, merged.origins);
  issues.push(...validated.issues);

  const linked = link(validated, merged.origins);
  issues.push(...linked.issues);

  if (issues.length > 0) return { ok: false, issues };

  const mods: ModInfo[] = ordered.packages.map((pkg, index) => ({
    id: pkg.manifest.id,
    name: pkg.manifest.name,
    version: pkg.manifest.version,
    order: index,
  }));

  return {
    ok: true,
    content: freeze({
      mods,
      unitTypes: linked.unitTypes,
      factions: linked.factions,
      unitTypeByKey: linked.unitTypeByKey,
      factionByKey: linked.factionByKey,
    }),
  };
}
