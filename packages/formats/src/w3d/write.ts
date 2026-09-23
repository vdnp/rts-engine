/**
 * W3D yazici.
 *
 * TEST FIXTURE'LARI URETMEK icindir. Amac, ayristiricinin gercek bir dosya
 * uzerinde degil, icerigini tam olarak bildigimiz bir dosya uzerinde
 * dogrulanabilmesidir: yaz -> ayristir -> karsilastir.
 *
 * EA'ya ait hicbir dosya bu depoya girmez. `BFME_GAME_PATH` altindaki gercek
 * dosyalar yalnizca elle dogrulama icindir ve asla commit edilmez.
 *
 * Govde duzenleri topluluk belgelerinden alinmistir. Bu asamada govdeler
 * YORUMLANMADIGI icin dogrulugun olcusu yapisal tutarliliktir: boyutlar,
 * hizalama ve ic ice gecme.
 */
import { SUB_CHUNK_FLAG } from './chunks';

/** Yazilacak chunk tanimi: ya govde ya alt chunk'lar, ikisi birden olmaz. */
export interface ChunkInput {
  readonly id: number;
  readonly data?: Uint8Array;
  readonly children?: readonly ChunkInput[];
}

function chunkByteLength(chunk: ChunkInput): number {
  const body =
    chunk.children === undefined
      ? (chunk.data?.length ?? 0)
      : chunk.children.reduce((total, child) => total + chunkByteLength(child), 0);
  return 8 + body;
}

/** Chunk agacini bayt dizisine yazar. */
export function writeW3dChunks(chunks: readonly ChunkInput[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunkByteLength(chunk), 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let cursor = 0;

  const emit = (chunk: ChunkInput): void => {
    const hasChildren = chunk.children !== undefined;
    const bodySize = chunkByteLength(chunk) - 8;

    view.setUint32(cursor, chunk.id, true);
    view.setUint32(cursor + 4, hasChildren ? (bodySize | SUB_CHUNK_FLAG) >>> 0 : bodySize, true);
    cursor += 8;

    if (hasChildren) {
      for (const child of chunk.children ?? []) emit(child);
    } else if (chunk.data !== undefined) {
      out.set(chunk.data, cursor);
      cursor += chunk.data.length;
    }
  };

  for (const chunk of chunks) emit(chunk);
  return out;
}

/** Sabit uzunlukta, sifirla doldurulmus ASCII alan yazar. */
export function fixedString(text: string, size: number): Uint8Array {
  const out = new Uint8Array(size);
  const limit = Math.min(text.length, size - 1);
  for (let i = 0; i < limit; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/** Sayisal alanlari sirayla yazmak icin kucuk bir yardimci. */
export class ByteWriter {
  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  private cursor = 0;

  constructor(size: number) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
  }

  u16(value: number): this {
    this.view.setUint16(this.cursor, value, true);
    this.cursor += 2;
    return this;
  }

  u32(value: number): this {
    this.view.setUint32(this.cursor, value >>> 0, true);
    this.cursor += 4;
    return this;
  }

  i32(value: number): this {
    this.view.setInt32(this.cursor, value | 0, true);
    this.cursor += 4;
    return this;
  }

  f32(value: number): this {
    this.view.setFloat32(this.cursor, value, true);
    this.cursor += 4;
    return this;
  }

  vec3(x: number, y: number, z: number): this {
    return this.f32(x).f32(y).f32(z);
  }

  raw(source: Uint8Array): this {
    this.bytes.set(source, this.cursor);
    this.cursor += source.length;
    return this;
  }

  /** Alani sonuna kadar sifirla doldurur ve sonucu dondurur. */
  finish(): Uint8Array {
    if (this.cursor !== this.bytes.length) {
      throw new RangeError(
        `ByteWriter: ${String(this.bytes.length)} bayt ayrildi, ${String(this.cursor)} yazildi.`,
      );
    }
    return this.bytes;
  }
}
