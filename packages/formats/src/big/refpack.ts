/**
 * RefPack acma (EA'nin sikistirma bicimi).
 *
 * BIG arsivlerindeki dosyalar cogunlukla sikistirilmamistir; sikistirilmis
 * olanlar `10 FB` imzasiyla baslar. Bicim topluluk belgelerinden ve dosyanin
 * kendisinden cozulmustur; orijinal oyunun kodu incelenmemistir.
 *
 * Baslik:
 *   bayt 0: bayraklar. 0x01 = sikistirilmis boyut alani var,
 *                      0x80 = 4 baytlik boyut alanlari
 *   bayt 1: 0xFB (imza)
 *   ardindan (bayrak 0x01 ise) sikistirilmis boyut, sonra acilmis boyut;
 *   her biri 3 bayt (veya 0x80 ise 4 bayt), buyuk endian.
 *
 * Komutlar (ilk bayta gore):
 *   0x00-0x7F  2 bayt   kisa geri referans
 *   0x80-0xBF  3 bayt   orta geri referans
 *   0xC0-0xDF  4 bayt   uzun geri referans
 *   0xE0-0xFB  1 bayt   yalnizca kopyala (geri referans yok)
 *   0xFC-0xFF  1 bayt   son: 0-3 bayt kopyala ve bitir
 */
import { ByteRangeError } from '../bytes';

/** RefPack imzasinin ikinci bayti. */
const SIGNATURE = 0xfb;

/** Cozulemeyen bir RefPack akisi icin firlatilir. */
export class RefPackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RefPackError';
  }
}

/** Baytlarin RefPack imzasi tasiyip tasimadigi. */
export function isRefPack(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false;
  return bytes[1] === SIGNATURE;
}

function readSize(bytes: Uint8Array, offset: number, wide: boolean): number {
  const width = wide ? 4 : 3;
  if (offset + width > bytes.length) {
    throw new ByteRangeError(offset, width, bytes.length);
  }
  let value = 0;
  for (let i = 0; i < width; i++) {
    value = value * 256 + (bytes[offset + i] ?? 0);
  }
  return value;
}

/**
 * Sikistirilmis akisi acar.
 *
 * @throws {RefPackError} imza yoksa veya akis beklenenden once biterse.
 */
export function decompressRefPack(bytes: Uint8Array): Uint8Array {
  if (!isRefPack(bytes)) {
    throw new RefPackError('RefPack imzasi (xx FB) bulunamadi.');
  }

  const flags = bytes[0] ?? 0;
  const wide = (flags & 0x80) !== 0;
  let cursor = 2;

  // Sikistirilmis boyut alani varsa atlanir; acilmis boyut bize yeter.
  if ((flags & 0x01) !== 0) cursor += wide ? 4 : 3;
  const decompressedSize = readSize(bytes, cursor, wide);
  cursor += wide ? 4 : 3;

  const out = new Uint8Array(decompressedSize);
  let written = 0;

  /** Girdiden dogrudan kopyalar. */
  const copyLiteral = (count: number): void => {
    if (cursor + count > bytes.length) {
      throw new RefPackError(`Akis beklenenden once bitti (${String(count)} bayt okunamadi).`);
    }
    if (written + count > out.length) {
      throw new RefPackError('Cikti acilmis boyutu asiyor; akis bozuk.');
    }
    out.set(bytes.subarray(cursor, cursor + count), written);
    cursor += count;
    written += count;
  };

  /** Ciktidan geri referansla kopyalar; ust uste binme kasitlidir. */
  const copyBack = (offset: number, count: number): void => {
    const from = written - offset;
    if (from < 0) {
      throw new RefPackError(`Gecersiz geri referans: ${String(offset)} bayt geride veri yok.`);
    }
    if (written + count > out.length) {
      throw new RefPackError('Cikti acilmis boyutu asiyor; akis bozuk.');
    }
    // Bayt bayt kopyalanir: kaynak ve hedef ust uste binebilir ve bu, kisa
    // bir oruntunun tekrarlanmasi icin BILEREK kullanilir.
    for (let i = 0; i < count; i++) {
      out[written + i] = out[from + i] ?? 0;
    }
    written += count;
  };

  for (;;) {
    if (cursor >= bytes.length) {
      throw new RefPackError('Akis bitis komutu olmadan sona erdi.');
    }
    const command = bytes[cursor] ?? 0;
    cursor += 1;

    if (command < 0x80) {
      const second = bytes[cursor] ?? 0;
      cursor += 1;
      copyLiteral(command & 0x03);
      copyBack(((command & 0x60) << 3) + second + 1, ((command & 0x1c) >> 2) + 3);
      continue;
    }

    if (command < 0xc0) {
      const second = bytes[cursor] ?? 0;
      const third = bytes[cursor + 1] ?? 0;
      cursor += 2;
      copyLiteral((second >> 6) & 0x03);
      copyBack(((second & 0x3f) << 8) + third + 1, (command & 0x3f) + 4);
      continue;
    }

    if (command < 0xe0) {
      const second = bytes[cursor] ?? 0;
      const third = bytes[cursor + 1] ?? 0;
      const fourth = bytes[cursor + 2] ?? 0;
      cursor += 3;
      copyLiteral(command & 0x03);
      copyBack(
        ((command & 0x10) << 12) + (second << 8) + third + 1,
        ((command & 0x0c) << 6) + fourth + 5,
      );
      continue;
    }

    if (command < 0xfc) {
      copyLiteral(((command & 0x1f) << 2) + 4);
      continue;
    }

    copyLiteral(command & 0x03);
    break;
  }

  if (written !== out.length) {
    throw new RefPackError(
      `Acilmis boyut tutmuyor: beklenen ${String(out.length)}, uretilen ${String(written)}.`,
    );
  }
  return out;
}
