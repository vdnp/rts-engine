/**
 * BIG arsiv okuyucu.
 *
 * Bicim topluluk belgelerinden ve dosyanin kendisinden cozulmustur; orijinal
 * oyunun binary'si incelenmemistir.
 *
 * Baslik (16 bayt):
 *   0  4 bayt  imza: "BIGF" veya "BIG4"
 *   4  4 bayt  arsivin toplam boyutu — KUCUK endian
 *   8  4 bayt  dosya sayisi        — buyuk endian
 *  12  4 bayt  veri bolumunun basladigi konum — buyuk endian
 *
 * Ardindan her dosya icin:
 *   4 bayt  konum (buyuk endian)
 *   4 bayt  boyut (buyuk endian)
 *   sifirla biten ASCII ad
 *
 * Endian karisikligi bicime ozgudur: yalnizca 4. bayttaki toplam boyut
 * kucuk endian, geri kalan tum sayilar buyuk endian.
 */
import { ByteReader, magicAt } from '../bytes';
import { decompressRefPack, isRefPack } from './refpack';

/** Taninan arsiv imzalari. */
export const BIG_MAGICS = ['BIGF', 'BIG4'] as const;

export type BigMagic = (typeof BIG_MAGICS)[number];

/** Arsivdeki bir girdi. */
export interface BigEntry {
  /** Arsiv icindeki yol. Ayrac genellikle `\` olur; oldugu gibi korunur. */
  readonly name: string;
  /** Dosya verisinin arsiv icindeki konumu. */
  readonly offset: number;
  /** Dosya verisinin ham (acilmamis) boyutu. */
  readonly size: number;
}

export interface BigArchive {
  readonly magic: BigMagic;
  /** Baslikta yazan toplam boyut. Gercek dosya boyutundan farkli olabilir. */
  readonly declaredSize: number;
  /** Veri bolumunun basladigi konum. */
  readonly dataStart: number;
  /** Girdiler, arsivdeki sirayla. */
  readonly entries: readonly BigEntry[];
}

/** Bozuk veya taninmayan bir arsiv icin firlatilir. */
export class BigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BigError';
  }
}

function isBigMagic(value: string): value is BigMagic {
  return (BIG_MAGICS as readonly string[]).includes(value);
}

/** Baytlarin BIG arsivi olup olmadigi. */
export function isBigArchive(bytes: Uint8Array): boolean {
  return bytes.length >= 16 && isBigMagic(magicAt(bytes, 0));
}

/**
 * Arsiv basligini ve dosya tablosunu okur. Dosya VERİSİ okunmaz.
 *
 * @param bytes En azindan baslik ve dosya tablosunu kapsayan baytlar.
 * @param archiveSize Arsivin GERCEK boyutu. Yuz megabaytlik arsivleri
 *   bellege almadan taramak icin yalnizca bas kismi okunabilir; sinir
 *   denetimi o zaman tamponun degil dosyanin boyutuna gore yapilmalidir.
 * @throws {BigError} imza taninmazsa veya tablo bozuksa.
 */
export function readBigArchive(bytes: Uint8Array, archiveSize = bytes.length): BigArchive {
  if (bytes.length < 16) {
    throw new BigError(`Arsiv cok kisa: ${String(bytes.length)} bayt.`);
  }
  const magic = magicAt(bytes, 0);
  if (!isBigMagic(magic)) {
    throw new BigError(`Taninmayan imza "${magic}"; BIGF veya BIG4 bekleniyordu.`);
  }

  const reader = new ByteReader(bytes);
  reader.seek(4);
  const declaredSize = reader.u32le();
  const entryCount = reader.u32be();
  const dataStart = reader.u32be();

  if (entryCount > archiveSize) {
    throw new BigError(`Dosya sayisi (${String(entryCount)}) arsiv boyutundan buyuk; tablo bozuk.`);
  }

  const entries: BigEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    const offset = reader.u32be();
    const size = reader.u32be();
    const name = reader.cstring();
    if (offset + size > archiveSize) {
      throw new BigError(
        `"${name}" arsiv sinirlarinin disinda: konum ${String(offset)}, boyut ${String(size)}, arsiv ${String(archiveSize)} bayt.`,
      );
    }
    entries.push({ name, offset, size });
  }

  return { magic, declaredSize, dataStart, entries };
}

/**
 * Bir girdinin ham baytlari. Sikistirilmis olabilir.
 * Kaynak tamponu KOPYALAMAZ.
 */
export function rawEntryBytes(bytes: Uint8Array, entry: BigEntry): Uint8Array {
  return bytes.subarray(entry.offset, entry.offset + entry.size);
}

/**
 * Bir girdinin kullanilabilir icerigi.
 * RefPack ile sikistirilmissa acilir, degilse oldugu gibi dondurulur.
 */
export function readEntry(bytes: Uint8Array, entry: BigEntry): Uint8Array {
  const raw = rawEntryBytes(bytes, entry);
  return isRefPack(raw) ? decompressRefPack(raw) : raw;
}

/**
 * Adi verilen girdiyi bulur.
 *
 * Arama buyuk/kucuk harf ve yol ayraci farkini yok sayar: arsivlerde
 * `art\w3d\x.w3d` ve `Art/W3D/X.W3D` ayni dosyayi gosterir.
 */
export function findEntry(archive: BigArchive, name: string): BigEntry | undefined {
  const wanted = normalizeEntryName(name);
  return archive.entries.find((entry) => normalizeEntryName(entry.name) === wanted);
}

/** Karsilastirma icin girdi adini normalize eder. */
export function normalizeEntryName(name: string): string {
  return name.replace(/\\/g, '/').toLowerCase();
}
