/**
 * Bicim komutlarinin cekirdegi.
 *
 * Dosya okuma CLI'da; burasi bayt dizisi alir, satir dizisi dondurur.
 * Boylece cikti bicimi dosya sistemi olmadan test edilir.
 */
import {
  type BigArchive,
  type BigEntry,
  chunkCounts,
  findEntry,
  formatChunkTree,
  isBigArchive,
  isRefPack,
  normalizeEntryName,
  parseW3dChunks,
  rawEntryBytes,
  readBigArchive,
  readEntry,
} from '@bfme/formats';
import { table } from './report';

/** Bayt sayisini okunabilir hale getirir. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** `devctl big ls` ciktisi. */
export function formatBigListing(
  bytes: Uint8Array,
  path: string,
  filter?: string,
): { lines: string[]; entryCount: number } {
  const archive = readBigArchive(bytes);
  const needle = filter === undefined ? undefined : normalizeEntryName(filter);
  const entries =
    needle === undefined
      ? archive.entries
      : archive.entries.filter((entry) => normalizeEntryName(entry.name).includes(needle));

  const lines = [
    `arsiv   ${path}`,
    `imza    ${archive.magic}`,
    `girdi   ${String(archive.entries.length)}${
      needle === undefined ? '' : ` (${String(entries.length)} eslesme)`
    }`,
    `veri    ${String(archive.dataStart)}. bayttan itibaren`,
    '',
  ];

  if (entries.length === 0) {
    lines.push('Eslesen girdi yok.');
    return { lines, entryCount: 0 };
  }

  lines.push(
    ...table(
      ['konum', 'boyut', 'sikisik', 'ad'],
      entries.map((entry) => [
        String(entry.offset),
        humanSize(entry.size),
        isRefPack(rawEntryBytes(bytes, entry)) ? 'evet' : '—',
        entry.name,
      ]),
    ),
  );
  return { lines, entryCount: entries.length };
}

/** Bir girdiyi bulur ve acilmis icerigini dondurur. */
export function extractEntry(
  bytes: Uint8Array,
  name: string,
): { archive: BigArchive; entry: BigEntry; data: Uint8Array } {
  const archive = readBigArchive(bytes);
  const entry = findEntry(archive, name);
  if (entry === undefined) {
    throw new Error(
      `"${name}" arsivde yok. ${String(archive.entries.length)} girdi var; ` +
        '`devctl big ls` ile listeleyebilirsin.',
    );
  }
  return { archive, entry, data: readEntry(bytes, entry) };
}

/** `devctl w3d dump` ciktisi. */
export function formatW3dDump(bytes: Uint8Array, path: string): string[] {
  const chunks = parseW3dChunks(bytes);
  const counts = [...chunkCounts(chunks).entries()].sort((a, b) =>
    b[1] - a[1] !== 0 ? b[1] - a[1] : a[0] < b[0] ? -1 : 1,
  );

  return [
    `dosya   ${path}`,
    `boyut   ${humanSize(bytes.length)}`,
    `ust chunk  ${String(chunks.length)}`,
    '',
    ...formatChunkTree(chunks),
    '',
    'chunk sayilari:',
    ...table(
      ['chunk', 'adet'],
      counts.map(([name, count]) => [name, String(count)]),
    ),
  ];
}

/**
 * Bir dosyanin BIG arsivi mi yoksa dogrudan W3D mi oldugunu soyler.
 * W3D'nin sabit bir imzasi yoktur; ayristirmayi denemek tek guvenilir yoldur.
 */
export function looksLikeBig(bytes: Uint8Array): boolean {
  return isBigArchive(bytes);
}
