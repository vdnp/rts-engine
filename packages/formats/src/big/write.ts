/**
 * BIG arsiv yazici.
 *
 * TEST FIXTURE'LARI URETMEK icindir: icerigini tam olarak bildigimiz bir
 * arsiv yazip okuyucunun ayni seyi geri verdigini dogrulariz.
 *
 * Endian karisikligi okuyucudakiyle aynidir: yalnizca toplam boyut kucuk
 * endian, geri kalan her sey buyuk endian.
 */

export interface BigInput {
  /** Arsiv icindeki yol. */
  readonly name: string;
  readonly data: Uint8Array;
}

/** Ad alaninin bayt uzunlugu (sonlandirici dahil). */
function nameLength(name: string): number {
  return name.length + 1;
}

/**
 * Girdilerden bir BIG arsivi olusturur.
 *
 * @param magic `BIGF` (varsayilan) veya `BIG4`.
 */
export function writeBigArchive(entries: readonly BigInput[], magic = 'BIGF'): Uint8Array {
  if (magic.length !== 4) {
    throw new RangeError(`BIG imzasi dort karakter olmali, alinan "${magic}".`);
  }

  const tableSize = entries.reduce((total, entry) => total + 8 + nameLength(entry.name), 0);
  const dataStart = 16 + tableSize;
  const totalSize = entries.reduce((total, entry) => total + entry.data.length, dataStart);

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  for (let i = 0; i < 4; i++) out[i] = magic.charCodeAt(i);
  view.setUint32(4, totalSize, true);
  view.setUint32(8, entries.length, false);
  view.setUint32(12, dataStart, false);

  let tableCursor = 16;
  let dataCursor = dataStart;
  for (const entry of entries) {
    view.setUint32(tableCursor, dataCursor, false);
    view.setUint32(tableCursor + 4, entry.data.length, false);
    tableCursor += 8;
    for (let i = 0; i < entry.name.length; i++) {
      out[tableCursor + i] = entry.name.charCodeAt(i) & 0xff;
    }
    tableCursor += nameLength(entry.name);

    out.set(entry.data, dataCursor);
    dataCursor += entry.data.length;
  }

  return out;
}
