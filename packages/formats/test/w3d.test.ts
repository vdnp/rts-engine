import { describe, expect, it } from 'vitest';
import { latin1 } from '../src/bytes';
import {
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
} from '../src/w3d/chunks';
import {
  ANIMATION_HEADER_SIZE,
  HIERARCHY_HEADER_SIZE,
  MESH_HEADER3_SIZE,
  PIVOT_SIZE,
  SAMPLE_BONE_COUNT,
  SAMPLE_FRAME_COUNT,
  SAMPLE_TRIANGLE_COUNT,
  SAMPLE_VERTEX_COUNT,
  TRIANGLE_SIZE,
  VERTEX_INFLUENCE_SIZE,
  W3D_ANIMATION,
  W3D_ANIMATION_CHANNEL,
  W3D_ANIMATION_HEADER,
  W3D_HIERARCHY,
  W3D_HIERARCHY_HEADER,
  W3D_MESH,
  W3D_MESH_HEADER3,
  W3D_PIVOTS,
  W3D_TRIANGLES,
  W3D_VERTEX_INFLUENCES,
  W3D_VERTEX_NORMALS,
  W3D_VERTICES,
  sampleW3dFile,
} from '../src/w3d/fixtures';
import { chunkName, isKnownChunk } from '../src/w3d/names';
import { writeW3dChunks } from '../src/w3d/write';

describe('chunk adlari', () => {
  it('bilinen kimlikleri adlandirir', () => {
    expect(chunkName(W3D_MESH)).toBe('MESH');
    expect(chunkName(W3D_HIERARCHY)).toBe('HIERARCHY');
    expect(chunkName(W3D_ANIMATION_CHANNEL)).toBe('ANIMATION_CHANNEL');
  });

  it('taninmayan kimlik icin ad UYDURMAZ', () => {
    expect(isKnownChunk(0xdeadbeef)).toBe(false);
    expect(chunkName(0xdeadbeef)).toBe('UNKNOWN_0xdeadbeef');
  });
});

describe('W3D — yaz/ayristir gidis donus', () => {
  it('duz chunk dizisini geri verir', () => {
    const bytes = writeW3dChunks([
      { id: 1, data: Uint8Array.from([1, 2, 3]) },
      { id: 2, data: Uint8Array.from([4, 5]) },
    ]);
    const chunks = parseW3dChunks(bytes);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.id).toBe(1);
    expect(chunks[0]?.size).toBe(3);
    expect([...(chunks[0]?.data ?? [])]).toEqual([1, 2, 3]);
    expect(chunks[1]?.offset).toBe(CHUNK_HEADER_SIZE + 3);
  });

  it('alt chunk bayragini yazar ve okur', () => {
    const bytes = writeW3dChunks([{ id: 10, children: [{ id: 11, data: Uint8Array.from([7]) }] }]);
    const view = new DataView(bytes.buffer);
    expect((view.getUint32(4, true) & SUB_CHUNK_FLAG) !== 0).toBe(true);

    const chunks = parseW3dChunks(bytes);
    expect(chunks[0]?.hasSubChunks).toBe(true);
    expect(chunks[0]?.children).toHaveLength(1);
    expect(chunks[0]?.children[0]?.id).toBe(11);
  });

  it('ic ice gecmis agaci korur', () => {
    const bytes = writeW3dChunks([
      {
        id: 1,
        children: [
          { id: 2, children: [{ id: 3, data: Uint8Array.from([9]) }] },
          { id: 4, data: new Uint8Array(0) },
        ],
      },
    ]);
    const chunks = parseW3dChunks(bytes);
    expect(chunks[0]?.children[0]?.children[0]?.id).toBe(3);
    expect(chunks[0]?.children[1]?.size).toBe(0);
  });

  it('konumlar dosyaya gore raporlanir', () => {
    const bytes = writeW3dChunks([
      { id: 1, children: [{ id: 2, data: Uint8Array.from([1, 2, 3, 4]) }] },
    ]);
    const chunks = parseW3dChunks(bytes);
    // dis chunk 0'da, ic chunk 8'de
    expect(chunks[0]?.offset).toBe(0);
    expect(chunks[0]?.children[0]?.offset).toBe(8);
  });

  it('bos girdi bos agac verir', () => {
    expect(parseW3dChunks(new Uint8Array(0))).toEqual([]);
  });
});

describe('W3D — bozuk dosya', () => {
  it('kapsayicisinin disina tasan chunk-u reddeder', () => {
    const bytes = writeW3dChunks([{ id: 1, data: Uint8Array.from([1, 2, 3]) }]);
    new DataView(bytes.buffer).setUint32(4, 0xff, true);
    expect(() => parseW3dChunks(bytes)).toThrow(W3dError);
    expect(() => parseW3dChunks(bytes)).toThrow(/disina tasiyor/);
  });

  it('sonda artik bayt kalirsa hata verir', () => {
    const bytes = writeW3dChunks([{ id: 1, data: Uint8Array.from([1, 2, 3]) }]);
    const padded = new Uint8Array(bytes.length + 3);
    padded.set(bytes);
    expect(() => parseW3dChunks(padded)).toThrow(/artik bayt/);
  });

  it('asiri ic ice gecmede dalmayi durdurur, dosyayi atmaz', () => {
    // Derinlik siniri ozyinelemeyi hala bagliyor; ama artik dosyayi
    // okunamaz saymak yerine o noktada yaprak kabul edip not dusuyoruz.
    let node: { id: number; children?: unknown[] } = { id: 1 };
    for (let i = 0; i < MAX_CHUNK_DEPTH + 5; i++) {
      node = { id: 1, children: [node] };
    }
    const bytes = writeW3dChunks([node as never]);

    const tree = parseW3dChunks(bytes);
    const failures = collectDescendFailures(tree);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.reason).toMatch(/ic ice gecme sinirini/);
  });

  it('metin tasiyan chunk alt chunk sanilirsa yaprak kabul edilir', () => {
    // Gercekte gorulen durum: VERTEX_MAPPER_ARGS govdesi ASCII metin ama
    // alt chunk bayragi kurulu. Govdedeki metin chunk basligi gibi
    // okunuyor ve cozulemiyor. Dosya bu yuzden atilmamali.
    const text = Uint8Array.from('UPerSpeed=1.0;', (c) => c.charCodeAt(0));
    const bytes = writeW3dChunks([{ id: 0x2e, children: [] }]);
    const patched = new Uint8Array(8 + text.length);
    patched.set(bytes.subarray(0, 8));
    patched.set(text, 8);
    // boyutu metin uzunluguna cek, alt chunk bayragini birak
    new DataView(patched.buffer).setUint32(4, (text.length | SUB_CHUNK_FLAG) >>> 0, true);

    const tree = parseW3dChunks(patched);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.name).toBe('VERTEX_MAPPER_ARGS0');
    expect(tree[0]?.children).toEqual([]);
    expect(tree[0]?.descendFailed).toBeDefined();
    expect(latin1(tree[0]?.data ?? new Uint8Array())).toBe('UPerSpeed=1.0;');
  });
});

describe('ornek W3D dosyasi', () => {
  const bytes = sampleW3dFile();
  const chunks = parseW3dChunks(bytes);

  it('uc ust duzey chunk icerir', () => {
    expect(chunks.map((chunk) => chunk.name)).toEqual(['MESH', 'HIERARCHY', 'ANIMATION']);
  });

  it('mesh govdesi 2 ucgen ve 4 kose tarif eder', () => {
    const header = findChunk(chunks, W3D_MESH_HEADER3);
    expect(header?.size).toBe(MESH_HEADER3_SIZE);

    const view = new DataView(
      header?.data.buffer ?? new ArrayBuffer(0),
      header?.data.byteOffset,
      header?.data.byteLength,
    );
    // NumTris ve NumVertices, 16+16 baytlik ad alanlarindan sonra gelir
    expect(view.getUint32(40, true)).toBe(SAMPLE_TRIANGLE_COUNT);
    expect(view.getUint32(44, true)).toBe(SAMPLE_VERTEX_COUNT);
  });

  it('mesh adini alandan okuyabiliriz', () => {
    const header = findChunk(chunks, W3D_MESH_HEADER3);
    const raw = header?.data.subarray(8, 24) ?? new Uint8Array();
    expect(latin1(raw).replace(/\0+$/, '')).toBe('ornek_mesh');
  });

  it('govde boyutlari bildirilen sayilarla tutarli', () => {
    expect(findChunk(chunks, W3D_VERTICES)?.size).toBe(SAMPLE_VERTEX_COUNT * 12);
    expect(findChunk(chunks, W3D_VERTEX_NORMALS)?.size).toBe(SAMPLE_VERTEX_COUNT * 12);
    expect(findChunk(chunks, W3D_TRIANGLES)?.size).toBe(SAMPLE_TRIANGLE_COUNT * TRIANGLE_SIZE);
    expect(findChunk(chunks, W3D_VERTEX_INFLUENCES)?.size).toBe(
      SAMPLE_VERTEX_COUNT * VERTEX_INFLUENCE_SIZE,
    );
  });

  it('iskelet 3 kemik tasir', () => {
    expect(findChunk(chunks, W3D_HIERARCHY_HEADER)?.size).toBe(HIERARCHY_HEADER_SIZE);
    expect(findChunk(chunks, W3D_PIVOTS)?.size).toBe(SAMPLE_BONE_COUNT * PIVOT_SIZE);
  });

  it('kok kemigin ebeveyni yoktur', () => {
    const pivots = findChunk(chunks, W3D_PIVOTS);
    const view = new DataView(
      pivots?.data.buffer ?? new ArrayBuffer(0),
      pivots?.data.byteOffset,
      pivots?.data.byteLength,
    );
    // ilk pivot: 16 baytlik addan sonra ebeveyn indeksi
    expect(view.getUint32(16, true)).toBe(0xffffffff);
    // ikinci pivotun ebeveyni kok
    expect(view.getUint32(PIVOT_SIZE + 16, true)).toBe(0);
  });

  it('animasyon 10 kare ve iki kanal tasir', () => {
    const animation = chunks.find((chunk) => chunk.id === W3D_ANIMATION);
    expect(findChunk(chunks, W3D_ANIMATION_HEADER)?.size).toBe(ANIMATION_HEADER_SIZE);

    const channels =
      animation?.children.filter((child) => child.id === W3D_ANIMATION_CHANNEL) ?? [];
    expect(channels).toHaveLength(2);
    // 12 baytlik baslik + kare basina bir float
    expect(channels[0]?.size).toBe(12 + SAMPLE_FRAME_COUNT * 4);
  });

  it('kanal basligi kare araligini dogru bildirir', () => {
    const channel = findChunk(chunks, W3D_ANIMATION_CHANNEL);
    const view = new DataView(
      channel?.data.buffer ?? new ArrayBuffer(0),
      channel?.data.byteOffset,
      channel?.data.byteLength,
    );
    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(SAMPLE_FRAME_COUNT - 1);
  });

  it('agacta beklenen chunk sayilari var', () => {
    const counts = chunkCounts(chunks);
    expect(counts.get('MESH')).toBe(1);
    expect(counts.get('ANIMATION_CHANNEL')).toBe(2);
    expect([...walkChunks(chunks)]).toHaveLength(13);
  });

  it('taninmayan chunk dosyayi okunamaz yapmaz', () => {
    const bytes = writeW3dChunks([
      { id: 0xdeadbeef, data: Uint8Array.from([1, 2]) },
      {
        id: W3D_MESH,
        children: [{ id: W3D_MESH_HEADER3, data: new Uint8Array(MESH_HEADER3_SIZE) }],
      },
    ]);
    const parsed = parseW3dChunks(bytes);
    expect(parsed[0]?.name).toBe('UNKNOWN_0xdeadbeef');
    expect(parsed[1]?.name).toBe('MESH');
  });
});

describe('formatChunkTree', () => {
  const lines = formatChunkTree(parseW3dChunks(sampleW3dFile()));

  it('her chunk icin bir satir yazar', () => {
    expect(lines).toHaveLength([...walkChunks(parseW3dChunks(sampleW3dFile()))].length);
  });

  it('kapsayici ve yaprak chunk-lari ayirir', () => {
    expect(lines[0]).toContain('+ MESH');
    expect(lines[1]).toContain('- MESH_HEADER3');
  });

  it('girinti ic ice gecmeyi gosterir', () => {
    expect(lines[0]?.startsWith('+')).toBe(true);
    expect(lines[1]?.startsWith('  -')).toBe(true);
  });

  it('kimlik, konum ve boyut icerir', () => {
    expect(lines[0]).toContain('0x00000000');
    expect(lines[0]).toContain('konum');
    expect(lines[0]).toContain('boyut');
  });
});
