/**
 * Asama 2 — resolve: bagimliliklar, surum araliklari, eksik/cakisan paketler.
 */
import type { ContentIssue } from '@bfme/schema';
import type { DiscoveredPackage } from './discover';
import { satisfies } from './version';

export interface ResolveResult {
  /** Bagimliliklari karsilanan paketler; girdi sirasini korur. */
  readonly packages: readonly DiscoveredPackage[];
  readonly issues: readonly ContentIssue[];
}

/**
 * Her paketin bagimliliklarinin mevcut ve surum araligina uygun oldugunu
 * dogrular. Ayni kimligi tasiyan iki paket cakisma sayilir.
 *
 * Hatalar toplanir; ilk hatada durulmaz.
 */
export function resolve(packages: readonly DiscoveredPackage[]): ResolveResult {
  const issues: ContentIssue[] = [];
  const byId = new Map<string, DiscoveredPackage>();

  for (const pkg of packages) {
    const existing = byId.get(pkg.manifest.id);
    if (existing !== undefined) {
      issues.push({
        file: `${pkg.dir}/manifest.toml`,
        line: pkg.lines.lineOf(['id']),
        path: 'id',
        expected: 'benzersiz paket kimligi',
        got: `"${pkg.manifest.id}" zaten "${existing.dir}" tarafindan kullaniliyor`,
        mod: pkg.dir,
        message: 'İki icerik paketi ayni kimligi kullanamaz.',
      });
      continue;
    }
    byId.set(pkg.manifest.id, pkg);
  }

  for (const pkg of packages) {
    const deps = Object.keys(pkg.manifest.dependencies).sort();
    for (const depId of deps) {
      const range = pkg.manifest.dependencies[depId] ?? '*';
      const dep = byId.get(depId);

      if (dep === undefined) {
        issues.push(dependencyIssue(pkg, depId, `yuklu paket "${depId}"`, 'paket yuklu degil'));
        continue;
      }
      if (dep === pkg) {
        issues.push(dependencyIssue(pkg, depId, 'baska bir paket', 'paketin kendisi'));
        continue;
      }
      if (!satisfies(dep.manifest.version, range)) {
        issues.push(
          dependencyIssue(
            pkg,
            depId,
            `"${depId}" surumu ${range}`,
            `surum ${dep.manifest.version}`,
          ),
        );
      }
    }
  }

  const broken = new Set(issues.map((i) => i.mod));
  return { packages: packages.filter((p) => !broken.has(p.dir)), issues };
}

function dependencyIssue(
  pkg: DiscoveredPackage,
  depId: string,
  expected: string,
  got: string,
): ContentIssue {
  return {
    file: `${pkg.dir}/manifest.toml`,
    line: pkg.lines.lineOf(['dependencies', depId]),
    path: `dependencies.${depId}`,
    expected,
    got,
    mod: pkg.dir,
    message: `"${pkg.dir}" paketinin bagimliligi karsilanmadi.`,
  };
}
