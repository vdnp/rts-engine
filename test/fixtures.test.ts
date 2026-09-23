/**
 * Depoya commit edilmis ikili fixture'larin butunlugu.
 *
 * Fixture'lar `devctl w3d sample` ile uretilir. Bu test, commit edilmis
 * dosyalarin uretecin bugunku ciktisiyla BIREBIR ayni oldugunu dogrular:
 * boylece fixture ile uretec sessizce birbirinden ayrilamaz.
 *
 * Depoda EA'ya ait hicbir dosya yoktur; bu fixture'lar tamamen bizim
 * yazicimizla uretilmistir.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPRESSED_ANIMATION_VERSIONS,
  MESH_HEADER3_VERSIONS,
  findChunk,
  parseW3dChunks,
  sampleW3dFile,
} from '@bfme/formats';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(repoRoot, 'packages', 'formats', 'test', 'fixtures');

const read = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(path.join(fixtureDir, name)));

/** Bir chunk'in ilk dort baytindaki surum alani. */
function versionOf(bytes: Uint8Array, chunkId: number): number {
  const chunk = findChunk(parseW3dChunks(bytes), chunkId);
  if (chunk === undefined) throw new Error(`chunk bulunamadi: ${String(chunkId)}`);
  return new DataView(chunk.data.buffer, chunk.data.byteOffset, 4).getUint32(0, true);
}

const MESH_HEADER3 = 0x0000001f;
const COMPRESSED_ANIMATION_HEADER = 0x00000281;

describe('commit edilmis W3D fixture-lari', () => {
  it('4.2 surumlu fixture uretecin ciktisiyla birebir ayni', () => {
    expect([...read('ornek-mesh42.w3d')]).toEqual([
      ...sampleW3dFile({ meshVersion: MESH_HEADER3_VERSIONS.v42 }),
    ]);
  });

  it('5.0 surumlu fixture uretecin ciktisiyla birebir ayni', () => {
    expect([...read('ornek-mesh50.w3d')]).toEqual([
      ...sampleW3dFile({
        meshVersion: MESH_HEADER3_VERSIONS.v50,
        compressedAnimationVersion: COMPRESSED_ANIMATION_VERSIONS.v01,
      }),
    ]);
  });

  it('gercekte GORULEN iki MESH_HEADER3 surumunu de kapsar', () => {
    expect(versionOf(read('ornek-mesh42.w3d'), MESH_HEADER3)).toBe(MESH_HEADER3_VERSIONS.v42);
    expect(versionOf(read('ornek-mesh50.w3d'), MESH_HEADER3)).toBe(MESH_HEADER3_VERSIONS.v50);
  });

  it('sikistirilmis animasyon surumunu tasir', () => {
    expect(versionOf(read('ornek-mesh50.w3d'), COMPRESSED_ANIMATION_HEADER)).toBe(
      COMPRESSED_ANIMATION_VERSIONS.v01,
    );
  });

  it('ikisi de ayristirilabilir ve beklenen agaci verir', () => {
    expect(parseW3dChunks(read('ornek-mesh42.w3d')).map((c) => c.name)).toEqual([
      'MESH',
      'HIERARCHY',
      'ANIMATION',
    ]);
    expect(parseW3dChunks(read('ornek-mesh50.w3d')).map((c) => c.name)).toEqual([
      'MESH',
      'HIERARCHY',
      'ANIMATION',
      'COMPRESSED_ANIMATION',
    ]);
  });
});
