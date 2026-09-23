/**
 * Bayt okuma yardimcilari.
 *
 * Bu paketteki bicimler hem buyuk hem kucuk endian alanlar tasir (BIG
 * basliginda ikisi yan yana bulunur), bu yuzden endian her cagrida acikca
 * secilir — varsayilan yoktur.
 */

/** Bir bayt diziliminin sonuna varildiginda veya sinir asildiginda firlatilir. */
export class ByteRangeError extends RangeError {
  constructor(offset: number, need: number, length: number) {
    super(
      `Bayt sinirlari asildi: ${String(offset)} konumunda ${String(need)} bayt istendi, toplam ${String(length)}.`,
    );
    this.name = 'ByteRangeError';
  }
}

/**
 * Konum tutan, sinir denetimli okuyucu.
 *
 * Bozuk veya kesilmis dosyalarda sessizce cop dondurmek yerine hata firlatir:
 * arsiv icerigi disaridan gelir ve guvenilmezdir.
 */
export class ByteReader {
  private position = 0;
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  /** Okunan bayt sayisi. */
  get offset(): number {
    return this.position;
  }

  /** Toplam uzunluk. */
  get length(): number {
    return this.bytes.length;
  }

  /** Geriye kalan bayt sayisi. */
  get remaining(): number {
    return this.bytes.length - this.position;
  }

  /** Okuma konumunu degistirir. */
  seek(offset: number): void {
    if (offset < 0 || offset > this.bytes.length) {
      throw new ByteRangeError(offset, 0, this.bytes.length);
    }
    this.position = offset;
  }

  private take(count: number): number {
    if (count < 0 || this.position + count > this.bytes.length) {
      throw new ByteRangeError(this.position, count, this.bytes.length);
    }
    const at = this.position;
    this.position = at + count;
    return at;
  }

  u8(): number {
    return this.view.getUint8(this.take(1));
  }

  u16le(): number {
    return this.view.getUint16(this.take(2), true);
  }

  u32le(): number {
    return this.view.getUint32(this.take(4), true);
  }

  u32be(): number {
    return this.view.getUint32(this.take(4), false);
  }

  i32le(): number {
    return this.view.getInt32(this.take(4), true);
  }

  f32le(): number {
    return this.view.getFloat32(this.take(4), true);
  }

  /** Sabit uzunlukta bayt dilimi; kaynak tamponu KOPYALAMAZ. */
  bytesOf(count: number): Uint8Array {
    const at = this.take(count);
    return this.bytes.subarray(at, at + count);
  }

  /** Sifirla biten ASCII metin. Sonlandirici tuketilir. */
  cstring(limit = 1024): string {
    const start = this.position;
    let end = start;
    while (end < this.bytes.length && this.bytes[end] !== 0) {
      end = end + 1;
      if (end - start > limit) {
        throw new ByteRangeError(start, limit, this.bytes.length);
      }
    }
    if (end >= this.bytes.length) {
      throw new ByteRangeError(start, end - start + 1, this.bytes.length);
    }
    this.position = end + 1;
    return latin1(this.bytes.subarray(start, end));
  }

  /**
   * Sabit uzunlukta, sifirla doldurulmus ASCII metin.
   * Alanin tamami tuketilir; ilk sifirdan sonrasi atilir.
   */
  fixedString(size: number): string {
    const raw = this.bytesOf(size);
    const end = raw.indexOf(0);
    return latin1(end === -1 ? raw : raw.subarray(0, end));
  }
}

/** Bayt dizisini Latin-1 metne cevirir. Oyun bicimleri ASCII kullanir. */
export function latin1(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

/** Dort karakterlik imzayi okur (konumu ilerletmez). */
export function magicAt(bytes: Uint8Array, offset: number): string {
  return latin1(bytes.subarray(offset, offset + 4));
}
