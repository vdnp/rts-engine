/**
 * Raporlarin metin bicimi.
 *
 * Saf fonksiyonlardir: rapor nesnesi alir, satir dizisi dondurur. Hicbir sey
 * yazdirmaz, dolayisiyla cikti bicimi test edilebilir.
 */
import { formatIssue } from '@bfme/modloader';
import type { ContentIssue } from '@bfme/modloader';
import type { ModsReport, ValidateReport } from './inspect';

/** Sutunlari hizalayan kucuk bir tablo bicimleyici. */
export function table(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
  const widths = header.map((cell, column) =>
    Math.max(cell.length, ...rows.map((row) => (row[column] ?? '').length)),
  );
  const line = (cells: readonly string[]): string =>
    cells
      .map((cell, column) => cell.padEnd(widths[column] ?? 0))
      .join('  ')
      .trimEnd();

  return [line(header), line(widths.map((width) => '-'.repeat(width))), ...rows.map(line)];
}

/** Hatalari, en cok soruna sebep olan mod'u da sayarak bicimler. */
export function formatIssues(issues: readonly ContentIssue[]): string[] {
  if (issues.length === 0) return [];

  const byMod = new Map<string, number>();
  for (const issue of issues) {
    byMod.set(issue.mod, (byMod.get(issue.mod) ?? 0) + 1);
  }
  const counts = [...byMod.entries()]
    .sort((a, b) => (b[1] - a[1] !== 0 ? b[1] - a[1] : a[0] < b[0] ? -1 : 1))
    .map(([mod, count]) => `${mod} (${String(count)})`);

  return [
    `${String(issues.length)} hata — sorumlu mod: ${counts.join(', ')}`,
    '',
    ...issues.flatMap((issue) => [formatIssue(issue), '']),
  ];
}

/** `devctl mods` ciktisi. */
export function formatMods(report: ModsReport, contentDir: string): string[] {
  const lines = [`icerik  ${contentDir}`, ''];

  if (report.packages.length === 0) {
    lines.push('Hic icerik paketi bulunamadi.');
  } else {
    lines.push(
      ...table(
        ['kimlik', 'surum', 'dosya', 'durum', 'bagimlilik'],
        report.packages.map((pkg) => [
          pkg.id,
          pkg.version,
          String(pkg.fileCount),
          pkg.ok ? 'hazir' : 'SORUNLU',
          pkg.dependencies.length === 0
            ? '—'
            : pkg.dependencies.map((dep) => `${dep.id} ${dep.range}`).join(', '),
        ]),
      ),
    );
  }

  lines.push('');
  lines.push(
    report.loadOrder.length === 0
      ? 'yukleme sirasi: (bos)'
      : `yukleme sirasi: ${report.loadOrder.join(' -> ')}`,
  );

  if (report.issues.length > 0) {
    lines.push('', ...formatIssues(report.issues));
  }
  return lines;
}

/** `devctl validate` ciktisi. */
export function formatValidate(
  report: ValidateReport,
  contentDir: string,
  mods: readonly string[],
): string[] {
  const lines = [`icerik  ${contentDir}`, `modlar  ${mods.join(', ')}`, ''];

  if (!report.ok || report.summary === undefined) {
    lines.push(...formatIssues(report.issues));
    return lines;
  }

  const summary = report.summary;
  lines.push('hata yok', '');
  lines.push(
    ...table(
      ['alan', 'deger'],
      [
        ['dataHash', summary.dataHash],
        ['modul', summary.mods.map((mod) => `${mod.id} ${mod.version}`).join(', ')],
        ['birim tipi', String(summary.unitTypeCount)],
        ['fraksiyon', String(summary.factionCount)],
        ...summary.roster.map((entry) => [
          `  kadro ${entry.faction}`,
          `${String(entry.unitTypes)} birim`,
        ]),
      ],
    ),
  );
  return lines;
}
