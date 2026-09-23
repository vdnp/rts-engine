/**
 * Disk gezintisi ve rapor bicimleme.
 *
 * Dosya erisimi burada; sayim ve degerlendirme `survey.ts` icinde saf
 * fonksiyonlarda. Raporlar stdout'a yazilir, depoya girmez.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { openBigArchive } from './bigFile';
import { humanSize } from './formats';
import { table } from './report';
import {
  type ArchiveReport,
  type ScanSummary,
  SurveyAccumulator,
  type SurveyFinding,
  type SurveyReport,
  entryExtension,
  rankCounts,
  suspiciousName,
} from './survey';

/** Bir dizini gezip verilen uzantilardaki dosyalari toplar. */
export function findFiles(root: string, extensions: readonly string[], depth = 0): string[] {
  if (depth > 12) return [];
  let names: string[];
  try {
    names = readdirSync(root).sort();
  } catch {
    return [];
  }

  const out: string[] = [];
  for (const name of names) {
    const full = path.join(root, name);
    let entry;
    try {
      entry = statSync(full);
    } catch {
      continue;
    }
    if (entry.isDirectory()) {
      out.push(...findFiles(full, extensions, depth + 1));
    } else if (extensions.some((extension) => name.toLowerCase().endsWith(extension))) {
      out.push(full);
    }
  }
  return out;
}

/** Tek bir arsivi inceler. */
export function scanArchive(archivePath: string): ArchiveReport {
  let opened;
  try {
    opened = openBigArchive(archivePath);
  } catch (error) {
    return {
      path: archivePath,
      fileSize: 0,
      magic: '????',
      entryCount: 0,
      sizeMatches: false,
      extensions: [],
      compressedCount: 0,
      suspicious: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    const { archive, fileSize } = opened;
    const extensions = new Map<string, number>();
    const suspicious: string[] = [];
    let compressed = 0;

    for (const entry of archive.entries) {
      const extension = entryExtension(entry.name);
      extensions.set(extension, (extensions.get(extension) ?? 0) + 1);

      if (suspiciousName(entry.name)) {
        suspicious.push(`adi bozuk: ${JSON.stringify(entry.name)}`);
      } else if (entry.size === 0) {
        suspicious.push(`bos girdi: ${entry.name}`);
      }

      // Sikistirma imzasi icin girdinin yalnizca ilk iki bayti okunur.
      if (entry.size >= 2) {
        const head = opened.readRaw({ ...entry, size: 2 });
        if (head[1] === 0xfb) compressed += 1;
      }
    }

    return {
      path: archivePath,
      fileSize,
      magic: archive.magic,
      entryCount: archive.entries.length,
      sizeMatches: archive.declaredSize === fileSize,
      extensions: rankCounts(extensions),
      compressedCount: compressed,
      suspicious,
    };
  } finally {
    opened.close();
  }
}

/** Bir dizindeki tum arsivleri tarar. */
export function scanDirectory(root: string): ScanSummary {
  const archives = findFiles(root, ['.big']).map(scanArchive);
  const totals = new Map<string, number>();
  let totalEntries = 0;

  for (const archive of archives) {
    totalEntries += archive.entryCount;
    for (const [extension, count] of archive.extensions) {
      totals.set(extension, (totals.get(extension) ?? 0) + count);
    }
  }

  return {
    archives,
    totalEntries,
    totalExtensions: rankCounts(totals),
    failed: archives.filter((archive) => archive.error !== undefined).length,
  };
}

/** `devctl big scan` ciktisi. */
export function formatScan(summary: ScanSummary, root: string): string[] {
  const lines = [`kok     ${root}`, `arsiv   ${String(summary.archives.length)}`, ''];

  if (summary.archives.length === 0) {
    lines.push('Hic .big arsivi bulunamadi.');
    return lines;
  }

  lines.push(
    ...table(
      ['arsiv', 'imza', 'boyut', 'girdi', 'sikisik', 'durum'],
      summary.archives.map((archive) => [
        path.basename(archive.path),
        archive.magic,
        humanSize(archive.fileSize),
        String(archive.entryCount),
        String(archive.compressedCount),
        archive.error !== undefined
          ? 'ACILAMADI'
          : archive.sizeMatches
            ? 'tamam'
            : 'boyut uyusmuyor',
      ]),
    ),
    '',
    'uzanti dagilimi:',
    ...table(
      ['uzanti', 'adet'],
      summary.totalExtensions.slice(0, 20).map(([ext, count]) => [ext, String(count)]),
    ),
    '',
    `toplam girdi: ${String(summary.totalEntries)}`,
  );

  const broken = summary.archives.filter((archive) => archive.error !== undefined);
  if (broken.length > 0) {
    lines.push('', 'acilamayan arsivler:');
    for (const archive of broken) lines.push(`  ${archive.path}: ${archive.error ?? ''}`);
  }

  const suspicious = summary.archives.flatMap((archive) =>
    archive.suspicious.map((note) => `  ${path.basename(archive.path)}: ${note}`),
  );
  if (suspicious.length > 0) {
    lines.push('', `supheli girdiler (${String(suspicious.length)}):`, ...suspicious.slice(0, 40));
    if (suspicious.length > 40) {
      lines.push(`  ... ve ${String(suspicious.length - 40)} tane daha`);
    }
  }

  return lines;
}

/**
 * Bir dizindeki tum W3D dosyalarini gezer.
 *
 * Hem diskteki `.w3d` dosyalari hem de `.big` arsivlerinin icindekiler
 * incelenir: oyunda modeller arsivlerin icinde yasar.
 */
export function surveyDirectory(root: string, limit: number): SurveyReport {
  const accumulator = new SurveyAccumulator();
  let seen = 0;

  for (const file of findFiles(root, ['.w3d'])) {
    if (seen >= limit) break;
    accumulator.add(path.relative(root, file), new Uint8Array(readFileSync(file)));
    seen += 1;
  }

  for (const archivePath of findFiles(root, ['.big'])) {
    if (seen >= limit) break;
    let opened;
    try {
      opened = openBigArchive(archivePath);
    } catch {
      continue;
    }
    try {
      for (const entry of opened.archive.entries) {
        if (seen >= limit) break;
        if (!entry.name.toLowerCase().endsWith('.w3d')) continue;
        const label = `${path.basename(archivePath)}!${entry.name}`;
        try {
          accumulator.add(label, opened.read(entry));
        } catch (error) {
          // Acilamayan girdi de bir bulgudur: bos tampon parse hatasi uretir.
          accumulator.addFailure(label, error instanceof Error ? error.message : String(error));
        }
        seen += 1;
      }
    } finally {
      opened.close();
    }
  }

  return accumulator.report();
}

/** `devctl w3d survey` ciktisi. */
export function formatSurvey(report: SurveyReport, root: string): string[] {
  const lines = [
    `kok     ${root}`,
    `dosya   ${String(report.fileCount)} W3D ayristirildi`,
    `hata    ${String(report.parseErrors.length)}`,
    '',
  ];

  if (report.fileCount === 0 && report.parseErrors.length === 0) {
    lines.push('Hic W3D dosyasi bulunamadi.');
    return lines;
  }

  lines.push(
    'chunk histogrami:',
    ...table(
      ['chunk', 'adet'],
      report.chunkHistogram.map(([name, count]) => [name, String(count)]),
    ),
  );

  lines.push(
    '',
    report.unknownChunks.length === 0
      ? 'taninmayan chunk yok.'
      : `TANINMAYAN chunk kimlikleri (${String(report.unknownChunks.length)} cesit):`,
  );
  if (report.unknownChunks.length > 0) {
    lines.push(
      ...table(
        ['kimlik', 'adet'],
        report.unknownChunks.map(([id, count]) => [id, String(count)]),
      ),
    );
  }

  if (report.flagConflicts.length > 0) {
    lines.push(
      '',
      `BAYRAK TUTARSIZLIGI (${String(report.flagConflicts.length)} chunk):`,
      '  ayni kimlik hem kapsayici hem yaprak olarak gorulmus',
      ...table(
        ['chunk', 'kapsayici', 'yaprak'],
        report.flagConflicts.map(([name, container, leaf]) => [
          name,
          String(container),
          String(leaf),
        ]),
      ),
    );
  } else {
    lines.push('', 'bayrak tutarsizligi: yok');
  }

  if (report.descendFailures.length > 0) {
    lines.push(
      '',
      'dalinamadi (yaprak kabul edildi, dosya atilmadi):',
      ...table(
        ['chunk', 'adet'],
        report.descendFailures.map(([name, count]) => [name, String(count)]),
      ),
    );
  }

  lines.push('', `Faz 1'de yorumlanmayacagi bilinen chunk: ${String(report.skippedChunks)}`);

  lines.push(
    '',
    'surum alanlari:',
    ...table(
      ['chunk ve surum', 'adet'],
      report.versions.map(([label, count]) => [label, String(count)]),
    ),
  );

  const sections: [string, readonly SurveyFinding[]][] = [
    ['boyut tutarsizliklari (adim)', report.strideMismatches],
    ['bildirilen sayi ile govde uyusmazligi', report.countMismatches],
    ['ayristirma hatalari', report.parseErrors],
  ];
  for (const [title, findings] of sections) {
    lines.push(
      '',
      findings.length === 0 ? `${title}: yok` : `${title} (${String(findings.length)}):`,
    );
    for (const finding of findings.slice(0, 25)) {
      lines.push(`  ${finding.source}`, `    ${finding.detail}`);
    }
    if (findings.length > 25) {
      lines.push(`  ... ve ${String(findings.length - 25)} tane daha`);
    }
  }

  return lines;
}
