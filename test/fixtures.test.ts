/**
 * Depoya commit edilmis ikili fixture'larin butunlugu.
 *
 * Fixture'lar `devctl w3d sample` ile uretilir. Bu test, commit edilmis
 * dosyanin uretecin bugunku ciktisiyla BIREBIR ayni oldugunu dogrular:
 * boylece fixture ile uretec sessizce birbirinden ayrilamaz.
 *
 * Depoda EA'ya ait hicbir dosya yoktur; bu fixture tamamen bizim
 * yazicimizla uretilmistir.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseW3dChunks, sampleW3dFile } from '@bfme/formats';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(repoRoot, 'packages', 'formats', 'test', 'fixtures', 'ornek.w3d');

describe('commit edilmis W3D fixture', () => {
  const bytes = new Uint8Array(readFileSync(fixture));

  it('uretecin ciktisiyla birebir ayni', () => {
    expect([...bytes]).toEqual([...sampleW3dFile()]);
  });

  it('ayristirilabilir ve beklenen agaci verir', () => {
    const chunks = parseW3dChunks(bytes);
    expect(chunks.map((chunk) => chunk.name)).toEqual(['MESH', 'HIERARCHY', 'ANIMATION']);
  });
});
