/**
 * @bfme/formats — orijinal oyunun dosya bicimleri.
 *
 * Bu paket YALNIZCA derleme zamani araclarinda kullanilir. Calisma aninda
 * oyun kendi pismis bicimini okur; hicbir runtime paketi burayi import
 * edemez ve kural ESLint tarafindan zorlanir.
 *
 * Bicimler topluluk belgelerinden ve dosyalarin kendisinden cozulmustur.
 * Orijinal oyunun binary'si decompile veya disassemble EDILMEMISTIR.
 * Depoda EA'ya ait hicbir dosya bulunmaz; test fixture'lari bu paketteki
 * yazicilarla uretilir.
 */
export { ByteRangeError, ByteReader, latin1, magicAt } from './bytes';

export {
  BIG_MAGICS,
  BigError,
  findEntry,
  isBigArchive,
  normalizeEntryName,
  rawEntryBytes,
  readBigArchive,
  readEntry,
} from './big/big';
export type { BigArchive, BigEntry, BigMagic } from './big/big';

export { RefPackError, decompressRefPack, isRefPack } from './big/refpack';

export { writeBigArchive } from './big/write';
export type { BigInput } from './big/write';

export {
  CHUNK_HEADER_SIZE,
  MAX_CHUNK_DEPTH,
  SUB_CHUNK_FLAG,
  W3dError,
  chunkCounts,
  collectDescendFailures,
  findChunk,
  formatChunkTree,
  parseW3dChunks,
  walkChunks,
} from './w3d/chunks';
export type { W3dChunk } from './w3d/chunks';

export { NOT_INTERPRETED_IN_PHASE1, W3D_CHUNK_NAMES, chunkName, isKnownChunk } from './w3d/names';

export { ByteWriter, fixedString, writeW3dChunks } from './w3d/write';
export type { ChunkInput } from './w3d/write';

export {
  COMPRESSED_ANIMATION_VERSIONS,
  MESH_HEADER3_VERSIONS,
  SAMPLE_BONE_COUNT,
  SAMPLE_FRAME_COUNT,
  SAMPLE_TRIANGLE_COUNT,
  SAMPLE_VERTEX_COUNT,
  sampleAnimationChunk,
  sampleCompressedAnimationChunk,
  sampleHierarchyChunk,
  sampleMeshChunk,
  sampleW3dFile,
  w3dVersion,
} from './w3d/fixtures';
export type { SampleOptions } from './w3d/fixtures';
