/**
 * W3D chunk agaci ayristirici.
 *
 * Bicim topluluk belgelerinden ve dosyanin kendisinden cozulmustur.
 *
 * Dosya duz bir chunk dizisidir; her chunk 8 baytlik bir baslikla baslar:
 *   0  4 bayt  chunk kimligi (kucuk endian)
 *   4  4 bayt  boyut alani   (kucuk endian)
 *
 * Boyut alaninin en yuksek biti (0x80000000) "bu chunk alt chunk'lar
 * icerir" demektir; gercek boyut alt 31 bittir. Ayristirma KIMLIKTEN
 * BAGIMSIZDIR: hangi chunk'in ne oldugunu bilmeden de agac cikarilabilir,
 * bu yuzden taninmayan chunk'lar dosyayi okunamaz yapmaz.
 *
 * Bu asamada chunk GOVDELERI yorumlanmaz — amac bicimin yapisini gercekten
 * okuyabildigimizi gostermek.
 */
import { chunkName } from './names';

/** Alt chunk bayragi. */
export const SUB_CHUNK_FLAG = 0x80000000;

/** Chunk baslik boyutu. */
export const CHUNK_HEADER_SIZE = 8;

/** Kotu niyetli veya bozuk dosyalarda sonsuz ic ice gecmeye karsi sinir. */
export const MAX_CHUNK_DEPTH = 32;

export interface W3dChunk {
  readonly id: number;
  /** Okunabilir ad; taninmayan kimlikler onaltilik gosterilir. */
  readonly name: string;
  /** Chunk basliginin dosya icindeki konumu. */
  readonly offset: number;
  /** Govde boyutu (8 baytlik baslik haric). */
  readonly size: number;
  /** Boyut alaninda alt chunk bayragi var miydi. */
  readonly hasSubChunks: boolean;
  readonly children: readonly W3dChunk[];
  /**
   * Chunk alt chunk iceriyormus gibi isaretliydi ama govdesi chunk akisi
   * olarak COZULEMEDI; yaprak kabul edildi. Sebep burada durur.
   *
   * Bu gercekte olan bir sey: metin tasiyan bazi chunk'larda (orn.
   * VERTEX_MAPPER_ARGS) bayrak yanlis kuruluyor ve govdedeki ASCII,
   * chunk basligi gibi okunuyor. Dosyayi bu yuzden okunamaz saymak
   * yanlis olur; not dusulur ve devam edilir.
   */
  readonly descendFailed?: string;
  /** Govde baytlari. Kaynak tamponun gorunumudur, kopya degil. */
  readonly data: Uint8Array;
}

/** Bozuk bir chunk akisi icin firlatilir. */
export class W3dError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'W3dError';
  }
}

/**
 * Bayt dizisini chunk agacina cevirir.
 *
 * @param baseOffset Raporlanan konumlara eklenecek taban; ic ice cagrilarda
 *   konumlarin dosyaya gore kalmasini saglar.
 * @throws {W3dError} bir chunk kendi kapsayicisinin disina tasarsa.
 */
export function parseW3dChunks(bytes: Uint8Array, baseOffset = 0, depth = 0): W3dChunk[] {
  if (depth > MAX_CHUNK_DEPTH) {
    throw new W3dError(`Chunk ic ice gecme sinirini asti (${String(MAX_CHUNK_DEPTH)}).`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: W3dChunk[] = [];
  let cursor = 0;

  while (cursor + CHUNK_HEADER_SIZE <= bytes.length) {
    const id = view.getUint32(cursor, true);
    const sizeField = view.getUint32(cursor + 4, true);
    const hasSubChunks = (sizeField & SUB_CHUNK_FLAG) !== 0;
    const size = sizeField & ~SUB_CHUNK_FLAG;

    const bodyStart = cursor + CHUNK_HEADER_SIZE;
    if (bodyStart + size > bytes.length) {
      throw new W3dError(
        `${chunkName(id)} chunk'i kapsayicisinin disina tasiyor: ` +
          `konum ${String(baseOffset + cursor)}, boyut ${String(size)}, ` +
          `kalan ${String(bytes.length - bodyStart)} bayt.`,
      );
    }

    const data = bytes.subarray(bodyStart, bodyStart + size);

    // Alt chunk bayragi bir IDDIADIR, garanti degil. Dalma denemesi
    // basarisiz olursa chunk yaprak kabul edilir ve sebep kaydedilir;
    // tek bir bozuk bayrak yuzunden dosyanin tamami atilmaz.
    let children: W3dChunk[] = [];
    let descendFailed: string | undefined;
    if (hasSubChunks) {
      try {
        children = parseW3dChunks(data, baseOffset + bodyStart, depth + 1);
      } catch (error) {
        descendFailed = error instanceof Error ? error.message : String(error);
      }
    }

    chunks.push({
      id,
      name: chunkName(id),
      offset: baseOffset + cursor,
      size,
      hasSubChunks,
      children,
      ...(descendFailed === undefined ? {} : { descendFailed }),
      data,
    });

    cursor = bodyStart + size;
  }

  if (cursor !== bytes.length) {
    throw new W3dError(`Chunk akisinin sonunda ${String(bytes.length - cursor)} artik bayt kaldi.`);
  }
  return chunks;
}

/** Agactaki tum chunk'lari on siralamada gezer. */
export function* walkChunks(chunks: readonly W3dChunk[]): Generator<W3dChunk> {
  for (const chunk of chunks) {
    yield chunk;
    yield* walkChunks(chunk.children);
  }
}

/** Verilen kimlige sahip ilk chunk. */
export function findChunk(chunks: readonly W3dChunk[], id: number): W3dChunk | undefined {
  for (const chunk of walkChunks(chunks)) {
    if (chunk.id === id) return chunk;
  }
  return undefined;
}

/** Dalinamamis chunk'lari agactan toplar. */
export function collectDescendFailures(
  chunks: readonly W3dChunk[],
): { chunk: W3dChunk; reason: string }[] {
  const out: { chunk: W3dChunk; reason: string }[] = [];
  for (const chunk of walkChunks(chunks)) {
    if (chunk.descendFailed !== undefined) out.push({ chunk, reason: chunk.descendFailed });
  }
  return out;
}

/** Agaci okunabilir metne cevirir; `devctl w3d dump` bunu yazdirir. */
export function formatChunkTree(chunks: readonly W3dChunk[], indent = 0): string[] {
  const lines: string[] = [];
  for (const chunk of chunks) {
    const pad = '  '.repeat(indent);
    const marker = chunk.hasSubChunks ? '+' : '-';
    lines.push(
      `${pad}${marker} ${chunk.name.padEnd(30 - pad.length)} ` +
        `0x${chunk.id.toString(16).padStart(8, '0')}  ` +
        `konum ${String(chunk.offset).padStart(8, ' ')}  ` +
        `boyut ${String(chunk.size).padStart(8, ' ')}` +
        (chunk.descendFailed !== undefined
          ? '  (dalinamadi)'
          : chunk.hasSubChunks
            ? `  (${String(chunk.children.length)} alt)`
            : ''),
    );
    lines.push(...formatChunkTree(chunk.children, indent + 1));
  }
  return lines;
}

/** Agactaki chunk sayilarini kimlige gore toplar. */
export function chunkCounts(chunks: readonly W3dChunk[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const chunk of walkChunks(chunks)) {
    counts.set(chunk.name, (counts.get(chunk.name) ?? 0) + 1);
  }
  return counts;
}
