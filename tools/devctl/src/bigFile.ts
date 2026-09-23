/**
 * Diskteki BIG arsivlerine konumsal erisim.
 *
 * Oyunun arsivleri yuzlerce megabayt olabilir. Tumunu bellege almak yerine
 * once yalnizca baslik ve dosya tablosu okunur, girdi verileri ise istendikce
 * kendi konumlarindan cekilir.
 *
 * Node dosya erisimi burada; `@bfme/formats` dosya sistemi bilmez.
 */
import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { type BigArchive, type BigEntry, isRefPack, readBigArchive } from '@bfme/formats';
import { decompressRefPack } from '@bfme/formats';

/** Baslik + tablo icin ilk okumada alinacak bayt sayisi. */
const HEADER_PROBE = 64 * 1024;

export interface OpenBigArchive {
  readonly archive: BigArchive;
  /** Arsivin diskteki boyutu. */
  readonly fileSize: number;
  /** Bir girdinin ham baytlari (sikistirilmis olabilir). */
  readRaw(entry: BigEntry): Uint8Array;
  /** Bir girdinin kullanilabilir icerigi; RefPack ise acilir. */
  read(entry: BigEntry): Uint8Array;
  close(): void;
}

function readAt(fd: number, offset: number, length: number): Uint8Array {
  const buffer = Buffer.allocUnsafe(length);
  const read = readSync(fd, buffer, 0, length, offset);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, read);
}

/**
 * Arsivi acar ve dosya tablosunu okur.
 *
 * @throws Dosya okunamazsa veya tablo bozuksa.
 */
export function openBigArchive(path: string): OpenBigArchive {
  const fileSize = statSync(path).size;
  const fd = openSync(path, 'r');

  try {
    // Once kucuk bir bas kismi; tablo bundan uzunsa gerektigi kadari alinir.
    const probeLength = Math.min(HEADER_PROBE, fileSize);
    let head = readAt(fd, 0, probeLength);
    if (head.length >= 16) {
      const dataStart = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(
        12,
        false,
      );
      if (dataStart > head.length && dataStart <= fileSize) {
        head = readAt(fd, 0, dataStart);
      }
    }

    const archive = readBigArchive(head, fileSize);
    return {
      archive,
      fileSize,
      readRaw: (entry) => readAt(fd, entry.offset, entry.size),
      read(entry) {
        const raw = readAt(fd, entry.offset, entry.size);
        return isRefPack(raw) ? decompressRefPack(raw) : raw;
      },
      close: () => {
        closeSync(fd);
      },
    };
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}
