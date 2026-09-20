/**
 * Asama 3 — order: topolojik siralama.
 *
 * Bagimlilik once yuklenir. Birbirine bagli olmayan paketlerin sirasi
 * `preferred` listesiyle (etkin mod sirasi) belirlenir; listede olmayanlar
 * alfabetik gelir. Bu iki kirici, siralamayi tamamen deterministik yapar.
 */
import type { ContentIssue } from '@bfme/schema';
import type { DiscoveredPackage } from './discover';

export interface OrderResult {
  /** Yukleme sirasinda paketler. Dongu varsa dongudekiler cikarilir. */
  readonly packages: readonly DiscoveredPackage[];
  readonly issues: readonly ContentIssue[];
}

/**
 * Kahn algoritmasi ile topolojik siralama.
 *
 * @param packages Bagimliliklari cozulmus paketler.
 * @param preferred Tercih edilen sira (etkin mod listesi). Eksik olanlar
 *   alfabetik siralanir.
 */
export function order(
  packages: readonly DiscoveredPackage[],
  preferred: readonly string[] = [],
): OrderResult {
  const byId = new Map(packages.map((p) => [p.manifest.id, p]));
  const rank = new Map<string, number>();
  for (const [index, id] of preferred.entries()) rank.set(id, index);

  const tieBreak = (a: string, b: string): number => {
    const ra = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a < b ? -1 : a > b ? 1 : 0;
  };

  /** id -> henuz yuklenmemis bagimlilik sayisi */
  const pending = new Map<string, number>();
  /** id -> bu pakete bagimli olanlar */
  const dependents = new Map<string, string[]>();

  for (const pkg of packages) {
    const deps = Object.keys(pkg.manifest.dependencies)
      .filter((d) => byId.has(d))
      .sort();
    pending.set(pkg.manifest.id, deps.length);
    for (const dep of deps) {
      const list = dependents.get(dep);
      if (list === undefined) dependents.set(dep, [pkg.manifest.id]);
      else list.push(pkg.manifest.id);
    }
  }

  const ready = [...pending.entries()]
    .filter(([, count]) => count === 0)
    .map(([id]) => id)
    .sort(tieBreak);

  const sorted: DiscoveredPackage[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as string;
    const pkg = byId.get(id);
    if (pkg !== undefined) sorted.push(pkg);

    for (const dependent of (dependents.get(id) ?? []).slice().sort(tieBreak)) {
      const left = (pending.get(dependent) ?? 0) - 1;
      pending.set(dependent, left);
      if (left === 0) {
        ready.push(dependent);
        ready.sort(tieBreak);
      }
    }
  }

  if (sorted.length === packages.length) {
    return { packages: sorted, issues: [] };
  }

  const stuck = packages.filter((p) => (pending.get(p.manifest.id) ?? 0) > 0);
  const cycle = stuck.map((p) => p.manifest.id).sort();
  const issues: ContentIssue[] = stuck.map((pkg) => ({
    file: `${pkg.dir}/manifest.toml`,
    line: pkg.lines.lineOf(['dependencies']),
    path: 'dependencies',
    expected: 'dongusuz bagimlilik grafigi',
    got: `dongu: ${cycle.join(' -> ')} -> ${cycle[0] ?? ''}`,
    mod: pkg.dir,
    message: 'Bagimlilik dongusu; bu paketler yuklenemez.',
  }));

  return { packages: sorted, issues };
}
