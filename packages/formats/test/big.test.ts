import { describe, expect, it } from 'vitest';
import {
  BigError,
  findEntry,
  isBigArchive,
  normalizeEntryName,
  rawEntryBytes,
  readBigArchive,
  readEntry,
} from '../src/big/big';
import { RefPackError, decompressRefPack, isRefPack } from '../src/big/refpack';
import { writeBigArchive } from '../src/big/write';
import { latin1 } from '../src/bytes';

const text = (value: string): Uint8Array =>
  Uint8Array.from(value, (character) => character.charCodeAt(0));

describe('BIG — yaz/oku gidis donus', () => {
  const entries = [
    { name: 'art\\w3d\\kutu.w3d', data: text('KUTU VERISI') },
    { name: 'ini\\birim.ini', data: text('speed = 10') },
    { name: 'bos.txt', data: new Uint8Array(0) },
  ];
  const archive = writeBigArchive(entries);

  it('imzayi taniyi', () => {
    expect(isBigArchive(archive)).toBe(true);
    expect(readBigArchive(archive).magic).toBe('BIGF');
  });

  it('girdileri sirasiyla ve dogru boyutla geri verir', () => {
    const parsed = readBigArchive(archive);
    expect(parsed.entries.map((entry) => entry.name)).toEqual(entries.map((entry) => entry.name));
    expect(parsed.entries.map((entry) => entry.size)).toEqual([11, 10, 0]);
  });

  it('icerigi birebir geri verir', () => {
    const parsed = readBigArchive(archive);
    for (const [index, entry] of parsed.entries.entries()) {
      expect(latin1(readEntry(archive, entry))).toBe(
        latin1(entries[index]?.data ?? new Uint8Array()),
      );
    }
  });

  it('baslik alanlari tutarli', () => {
    const parsed = readBigArchive(archive);
    expect(parsed.declaredSize).toBe(archive.length);
    // ilk girdinin verisi veri bolumunun basinda olmali
    expect(parsed.entries[0]?.offset).toBe(parsed.dataStart);
  });

  it('BIG4 imzasini da kabul eder', () => {
    const wide = writeBigArchive(entries, 'BIG4');
    expect(readBigArchive(wide).magic).toBe('BIG4');
  });

  it('bos arsiv yazilabilir ve okunabilir', () => {
    const empty = readBigArchive(writeBigArchive([]));
    expect(empty.entries).toEqual([]);
    expect(empty.dataStart).toBe(16);
  });

  it('gecersiz imzayi reddeder', () => {
    expect(() => writeBigArchive([], 'XX')).toThrow(RangeError);
  });
});

describe('BIG — girdi arama', () => {
  const archive = writeBigArchive([
    { name: 'Art\\W3D\\Kutu.w3d', data: text('a') },
    { name: 'ini/birim.ini', data: text('b') },
  ]);
  const parsed = readBigArchive(archive);

  it('buyuk/kucuk harf ve yol ayraci farkini yok sayar', () => {
    expect(findEntry(parsed, 'art/w3d/kutu.w3d')?.size).toBe(1);
    expect(findEntry(parsed, 'ART\\W3D\\KUTU.W3D')?.size).toBe(1);
    expect(findEntry(parsed, 'INI\\BIRIM.INI')?.size).toBe(1);
  });

  it('olmayan girdi icin tanimsiz doner', () => {
    expect(findEntry(parsed, 'yok.dat')).toBeUndefined();
  });

  it('normalizeEntryName kucuk harf ve ileri egik cizgi verir', () => {
    expect(normalizeEntryName('Art\\W3D\\X.W3D')).toBe('art/w3d/x.w3d');
  });
});

describe('BIG — bozuk dosya', () => {
  it('cok kisa dosyayi reddeder', () => {
    expect(() => readBigArchive(new Uint8Array(4))).toThrow(BigError);
  });

  it('taninmayan imzayi reddeder', () => {
    const bytes = new Uint8Array(32);
    bytes.set(text('ZIPF'), 0);
    expect(() => readBigArchive(bytes)).toThrow(/Taninmayan imza/);
    expect(isBigArchive(bytes)).toBe(false);
  });

  it('arsiv disina tasan girdiyi reddeder', () => {
    const archive = writeBigArchive([{ name: 'a', data: text('veri') }]);
    // boyut alanini sismis goster
    new DataView(archive.buffer).setUint32(16 + 4, 0xffff, false);
    expect(() => readBigArchive(archive)).toThrow(/sinirlarinin disinda/);
  });

  it('sismis dosya sayisini reddeder', () => {
    const archive = writeBigArchive([{ name: 'a', data: text('x') }]);
    new DataView(archive.buffer).setUint32(8, 0x7fffffff, false);
    expect(() => readBigArchive(archive)).toThrow(/tablo bozuk/);
  });

  it('kesilmis ad alaninda hata verir', () => {
    const archive = writeBigArchive([{ name: 'uzunca_bir_ad', data: text('x') }]);
    expect(() => readBigArchive(archive.subarray(0, 20))).toThrow();
  });
});

/**
 * RefPack akislari ELLE kurulur.
 *
 * Bir kodlayici yazip onunla test etmek, kodlayici ile cozucunun ayni yanlis
 * varsayimi paylasmasi riskini tasir. Burada her komut sinifi belgedeki
 * bit duzenine gore tek tek yazilip cozuluyor.
 */
describe('RefPack', () => {
  /** Baslik: bayrak 0x10, imza 0xFB, 3 bayt acilmis boyut (buyuk endian). */
  function header(size: number): number[] {
    return [0x10, 0xfb, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff];
  }

  const stream = (...parts: number[][]): Uint8Array => Uint8Array.from(parts.flat());

  it('imzayi taniyi', () => {
    expect(isRefPack(Uint8Array.from([0x10, 0xfb, 0, 0, 3]))).toBe(true);
    expect(isRefPack(Uint8Array.from([0x41, 0x42]))).toBe(false);
    expect(isRefPack(new Uint8Array(1))).toBe(false);
  });

  it('yalnizca duz kopya (0xE0-0xFB) cozer', () => {
    // 0xE0 -> 4 bayt kopyala; 0xFC -> 0 bayt kopyala ve bitir
    const data = decompressRefPack(stream(header(4), [0xe0], [0x41, 0x42, 0x43, 0x44], [0xfc]));
    expect(latin1(data)).toBe('ABCD');
  });

  it('bitis komutu 0-3 bayt kopyalayabilir', () => {
    // 0xFF -> 3 bayt kopyala ve bitir
    expect(latin1(decompressRefPack(stream(header(3), [0xff], [0x58, 0x59, 0x5a])))).toBe('XYZ');
  });

  it('kisa geri referansi (0x00-0x7F) cozer', () => {
    // once 4 bayt duz kopya: "ABCD"
    // sonra komut 0x00: kopyala 0, geri 1 bayt, 3 bayt tekrarla -> "DDD"
    const data = decompressRefPack(
      stream(header(7), [0xe0], [0x41, 0x42, 0x43, 0x44], [0x00, 0x00], [0xfc]),
    );
    expect(latin1(data)).toBe('ABCDDDD');
  });

  it('kisa geri referansta duz kopya ve uzaklik birlikte calisir', () => {
    // 0x01 -> proceed 1, uzunluk 3, offset = b1 + 1
    const data = decompressRefPack(
      stream(header(8), [0xe0], [0x41, 0x42, 0x43, 0x44], [0x01, 0x03, 0x45], [0xfc]),
    );
    // "ABCD" + "E" (duz) + 4 bayt geriden 3 bayt: "BCD"
    expect(latin1(data)).toBe('ABCDEBCD');
  });

  it('orta geri referansi (0x80-0xBF) cozer', () => {
    // 0x80 -> uzunluk 4, proceed = (b1 >> 6) & 3, offset = ((b1 & 0x3F) << 8) + b2 + 1
    const data = decompressRefPack(
      stream(header(8), [0xe0], [0x41, 0x42, 0x43, 0x44], [0x80, 0x00, 0x03], [0xfc]),
    );
    expect(latin1(data)).toBe('ABCDABCD');
  });

  it('uzun geri referansi (0xC0-0xDF) cozer', () => {
    // 0xC0 -> uzunluk = ((b0 & 0x0C) << 6) + b3 + 5, offset = (b1 << 8) + b2 + 1
    const data = decompressRefPack(
      stream(header(9), [0xe0], [0x41, 0x42, 0x43, 0x44], [0xc0, 0x00, 0x03, 0x00], [0xfc]),
    );
    expect(latin1(data)).toBe('ABCDABCDA');
  });

  it('ust uste binen geri referans oruntuyu tekrarlar', () => {
    // 1 bayt geriden 6 bayt: tek bir baytin tekrari
    const data = decompressRefPack(
      stream(header(10), [0xe0], [0x41, 0x42, 0x43, 0x44], [0x0c, 0x00], [0xfc]),
    );
    expect(latin1(data)).toBe('ABCDDDDDDD'.slice(0, 10));
  });

  it('4 baytlik boyut alanini (0x80 bayragi) okur', () => {
    const wide = Uint8Array.from([0x90, 0xfb, 0, 0, 0, 4, 0xe0, 0x41, 0x42, 0x43, 0x44, 0xfc]);
    expect(latin1(decompressRefPack(wide))).toBe('ABCD');
  });

  it('sikistirilmis boyut alanini (0x01 bayragi) atlar', () => {
    const withSize = Uint8Array.from([
      0x11, 0xfb, 0, 0, 12, 0, 0, 4, 0xe0, 0x41, 0x42, 0x43, 0x44, 0xfc,
    ]);
    expect(latin1(decompressRefPack(withSize))).toBe('ABCD');
  });

  it('imzasi olmayan akisi reddeder', () => {
    expect(() => decompressRefPack(Uint8Array.from([0x41, 0x42, 0x43]))).toThrow(RefPackError);
  });

  it('erken biten akisi reddeder', () => {
    expect(() => decompressRefPack(stream(header(100), [0xe0], [0x41]))).toThrow(
      /beklenenden once bitti|bitis komutu/,
    );
  });

  it('boyutu tutmayan akisi reddeder', () => {
    expect(() => decompressRefPack(stream(header(99), [0xfc]))).toThrow(/Acilmis boyut tutmuyor/);
  });

  it('gecersiz geri referansi reddeder', () => {
    // hicbir sey yazilmadan geriye bakmak
    expect(() => decompressRefPack(stream(header(8), [0x00, 0x00], [0xfc]))).toThrow(
      /Gecersiz geri referans/,
    );
  });
});

describe('BIG — sikistirilmis girdi', () => {
  it('RefPack girdiyi kendiliginden acar', () => {
    const compressed = Uint8Array.from([0x10, 0xfb, 0, 0, 4, 0xe0, 0x41, 0x42, 0x43, 0x44, 0xfc]);
    const archive = writeBigArchive([{ name: 'sikisik.dat', data: compressed }]);
    const parsed = readBigArchive(archive);
    const entry = parsed.entries[0];
    expect(entry).toBeDefined();
    if (entry === undefined) return;

    expect(latin1(readEntry(archive, entry))).toBe('ABCD');
    // ham baytlar hala sikistirilmis halde
    expect(rawEntryBytes(archive, entry).length).toBe(compressed.length);
  });

  it('sikistirilmamis girdiye dokunmaz', () => {
    const archive = writeBigArchive([{ name: 'duz.dat', data: text('DUZ VERI') }]);
    const parsed = readBigArchive(archive);
    const entry = parsed.entries[0];
    if (entry === undefined) throw new Error('girdi yok');
    expect(latin1(readEntry(archive, entry))).toBe('DUZ VERI');
  });
});
