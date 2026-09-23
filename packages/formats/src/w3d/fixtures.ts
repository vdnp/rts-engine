/**
 * Test fixture'i ureten ornek W3D icerigi.
 *
 * Uretilenler: 2 ucgenli bir mesh, 3 kemikli bir iskelet ve 10 kareli bir
 * animasyon. Icerik tamamen bizim oldugu icin ayristirici cikti ile
 * beklenen deger BIREBIR karsilastirilabilir.
 *
 * Govde duzenleri topluluk belgelerinden alinmistir. Alan uzunluklari
 * `*_SIZE` sabitlerinde yazili ve `ByteWriter.finish()` eksik/fazla yazmayi
 * hata olarak bildirir — yani yanlis bir duzen sessizce gecemez.
 */
import { ByteWriter, type ChunkInput, fixedString, writeW3dChunks } from './write';

export const W3D_MESH = 0x00000000;
export const W3D_VERTICES = 0x00000002;
export const W3D_VERTEX_NORMALS = 0x00000003;
export const W3D_VERTEX_INFLUENCES = 0x0000000e;
export const W3D_MESH_HEADER3 = 0x0000001f;
export const W3D_TRIANGLES = 0x00000020;
export const W3D_HIERARCHY = 0x00000100;
export const W3D_HIERARCHY_HEADER = 0x00000101;
export const W3D_PIVOTS = 0x00000102;
export const W3D_ANIMATION = 0x00000200;
export const W3D_ANIMATION_HEADER = 0x00000201;
export const W3D_ANIMATION_CHANNEL = 0x00000202;
export const W3D_COMPRESSED_ANIMATION = 0x00000280;
export const W3D_COMPRESSED_ANIMATION_HEADER = 0x00000281;

/** W3D surum alani: (major << 16) | minor. */
export function w3dVersion(major: number, minor: number): number {
  return ((major << 16) | minor) >>> 0;
}

/**
 * Gercek kurulumda GORULEN MESH_HEADER3 surumleri.
 *
 * `devctl w3d survey` 13159 mesh uzerinde yalnizca bu ikisini buldu
 * (4.2: 7011, 5.0: 6148) ve sayi-govde uyusmazligi SIFIR cikti. Yani
 * `NumTris` ve `NumVertices` alanlari iki surumde de ayni konumda
 * (40 ve 44). Bunun otesindeki alanlar henuz dogrulanmadi.
 */
export const MESH_HEADER3_VERSIONS = {
  v42: w3dVersion(4, 2),
  v50: w3dVersion(5, 0),
} as const;

/** Gercek kurulumda gorulen COMPRESSED_ANIMATION_HEADER surumleri. */
export const COMPRESSED_ANIMATION_VERSIONS = {
  v01: w3dVersion(0, 1),
  v10: w3dVersion(1, 0),
} as const;

/**
 * W3dCompressedAnimHeaderStruct boyutu.
 *
 * DIKKAT: yalnizca ilk dort baytin surum alani oldugu GERCEK VERIYLE
 * dogrulandi (survey mantikli 0.1 / 1.0 degerleri okudu). Geri kalan
 * duzen topluluk belgelerinden alindi ve henuz dogrulanmadi; animasyon
 * diliminde ele alinacak.
 */
export const COMPRESSED_ANIMATION_HEADER_SIZE = 44;

/** W3dMeshHeader3Struct boyutu. */
export const MESH_HEADER3_SIZE = 116;
/** W3dTriStruct boyutu: 3 indeks + oznitelik + normal + uzaklik. */
export const TRIANGLE_SIZE = 32;
/** W3dVertInfStruct boyutu: kemik indeksi + dolgu. */
export const VERTEX_INFLUENCE_SIZE = 8;
/** W3dHierarchyStruct boyutu. */
export const HIERARCHY_HEADER_SIZE = 36;
/** W3dPivotStruct boyutu: ad + ebeveyn + oteleme + euler + dondurme. */
export const PIVOT_SIZE = 60;
/** W3dAnimHeaderStruct boyutu. */
export const ANIMATION_HEADER_SIZE = 44;

/** Ornek mesh'in kose sayisi (iki ucgen bir dortgen paylasir). */
export const SAMPLE_VERTEX_COUNT = 4;
/** Ornek mesh'in ucgen sayisi. */
export const SAMPLE_TRIANGLE_COUNT = 2;
/** Ornek iskeletin kemik sayisi (kok + iki cocuk). */
export const SAMPLE_BONE_COUNT = 3;
/** Ornek animasyonun kare sayisi. */
export const SAMPLE_FRAME_COUNT = 10;

/** Birim karenin koseleri; iki ucgen bunlari paylasir. */
const VERTICES: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
];

/** Saat yonunun tersine iki ucgen. */
const TRIANGLES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 3],
];

/** Her kosenin bagli oldugu kemik. */
const VERTEX_BONES: readonly number[] = [0, 1, 1, 2];

function meshHeader(version: number): Uint8Array {
  return new ByteWriter(MESH_HEADER3_SIZE)
    .u32(version)
    .u32(0) // Attributes
    .raw(fixedString('ornek_mesh', 16))
    .raw(fixedString('ornek', 16))
    .u32(SAMPLE_TRIANGLE_COUNT)
    .u32(SAMPLE_VERTEX_COUNT)
    .u32(1) // NumMaterials
    .u32(0) // NumDamageStages
    .i32(0) // SortLevel
    .u32(0) // PrelitVersion
    .u32(0) // FutureCounts[1]
    .u32(0) // VertexChannels
    .u32(0) // FaceChannels
    .vec3(0, 0, 0) // Min
    .vec3(1, 1, 0) // Max
    .vec3(0.5, 0.5, 0) // SphCenter
    .f32(0.7071068) // SphRadius
    .finish();
}

function vertices(): Uint8Array {
  const writer = new ByteWriter(VERTICES.length * 12);
  for (const [x, y, z] of VERTICES) writer.vec3(x, y, z);
  return writer.finish();
}

function normals(): Uint8Array {
  const writer = new ByteWriter(VERTICES.length * 12);
  for (let i = 0; i < VERTICES.length; i++) writer.vec3(0, 0, 1);
  return writer.finish();
}

function triangles(): Uint8Array {
  const writer = new ByteWriter(TRIANGLES.length * TRIANGLE_SIZE);
  for (const [a, b, c] of TRIANGLES) {
    writer.u32(a).u32(b).u32(c).u32(0).vec3(0, 0, 1).f32(0);
  }
  return writer.finish();
}

function vertexInfluences(): Uint8Array {
  const writer = new ByteWriter(VERTEX_BONES.length * VERTEX_INFLUENCE_SIZE);
  for (const bone of VERTEX_BONES) {
    writer.u16(bone).u16(0).u16(0).u16(0);
  }
  return writer.finish();
}

/**
 * 2 ucgenli ornek mesh.
 *
 * @param version MESH_HEADER3 surumu; gercekte gorulen iki degerden biri.
 */
export function sampleMeshChunk(version: number = MESH_HEADER3_VERSIONS.v42): ChunkInput {
  return {
    id: W3D_MESH,
    children: [
      { id: W3D_MESH_HEADER3, data: meshHeader(version) },
      { id: W3D_VERTICES, data: vertices() },
      { id: W3D_VERTEX_NORMALS, data: normals() },
      { id: W3D_TRIANGLES, data: triangles() },
      { id: W3D_VERTEX_INFLUENCES, data: vertexInfluences() },
    ],
  };
}

function hierarchyHeader(): Uint8Array {
  return new ByteWriter(HIERARCHY_HEADER_SIZE)
    .u32(w3dVersion(4, 1))
    .raw(fixedString('ornek_iskelet', 16))
    .u32(SAMPLE_BONE_COUNT)
    .vec3(0, 0, 0)
    .finish();
}

/** Kok ve ona bagli iki kemik. */
const BONES: readonly { name: string; parent: number; offset: [number, number, number] }[] = [
  { name: 'kok', parent: 0xffffffff, offset: [0, 0, 0] },
  { name: 'kol_sol', parent: 0, offset: [-1, 0, 0] },
  { name: 'kol_sag', parent: 0, offset: [1, 0, 0] },
];

function pivots(): Uint8Array {
  const writer = new ByteWriter(BONES.length * PIVOT_SIZE);
  for (const bone of BONES) {
    writer
      .raw(fixedString(bone.name, 16))
      .u32(bone.parent)
      .vec3(bone.offset[0], bone.offset[1], bone.offset[2])
      .vec3(0, 0, 0) // euler acilari
      .f32(0) // dondurme x
      .f32(0) // dondurme y
      .f32(0) // dondurme z
      .f32(1); // dondurme w
  }
  return writer.finish();
}

/** 3 kemikli ornek iskelet. */
export function sampleHierarchyChunk(): ChunkInput {
  return {
    id: W3D_HIERARCHY,
    children: [
      { id: W3D_HIERARCHY_HEADER, data: hierarchyHeader() },
      { id: W3D_PIVOTS, data: pivots() },
    ],
  };
}

function animationHeader(): Uint8Array {
  return new ByteWriter(ANIMATION_HEADER_SIZE)
    .u32(w3dVersion(4, 1))
    .raw(fixedString('ornek_anim', 16))
    .raw(fixedString('ornek_iskelet', 16))
    .u32(SAMPLE_FRAME_COUNT)
    .u32(30) // kare hizi
    .finish();
}

/**
 * Tek bir kemigin X eksenindeki oteleme kanali.
 *
 * Baslik: ilk kare, son kare, vektor uzunlugu, bayraklar, pivot, dolgu.
 * Ardindan kare basina `vectorLength` adet float.
 */
function animationChannel(pivot: number, axis: number): Uint8Array {
  const vectorLength = 1;
  const size = 12 + vectorLength * SAMPLE_FRAME_COUNT * 4;
  const writer = new ByteWriter(size)
    .u16(0) // ilk kare
    .u16(SAMPLE_FRAME_COUNT - 1) // son kare
    .u16(vectorLength)
    .u16(axis) // 0 = X oteleme
    .u16(pivot)
    .u16(0); // dolgu
  for (let frame = 0; frame < SAMPLE_FRAME_COUNT; frame++) {
    writer.f32(frame * 0.1);
  }
  return writer.finish();
}

/** 10 kareli ornek animasyon: iki kemik hareket eder. */
export function sampleAnimationChunk(): ChunkInput {
  return {
    id: W3D_ANIMATION,
    children: [
      { id: W3D_ANIMATION_HEADER, data: animationHeader() },
      { id: W3D_ANIMATION_CHANNEL, data: animationChannel(1, 0) },
      { id: W3D_ANIMATION_CHANNEL, data: animationChannel(2, 0) },
    ],
  };
}

/**
 * Sikistirilmis animasyon ornegi.
 *
 * Govdenin YALNIZCA surum alani dogrulanmistir; kalan alanlar
 * ANIMATION_HEADER duzenini taklit eder ve gercek veriyle henuz
 * karsilastirilmamistir.
 */
export function sampleCompressedAnimationChunk(
  version: number = COMPRESSED_ANIMATION_VERSIONS.v01,
): ChunkInput {
  const header = new ByteWriter(COMPRESSED_ANIMATION_HEADER_SIZE)
    .u32(version)
    .raw(fixedString('ornek_sikisik', 16))
    .raw(fixedString('ornek_iskelet', 16))
    .u32(SAMPLE_FRAME_COUNT)
    .u16(30) // kare hizi
    .u16(0) // flavor
    .finish();

  return {
    id: W3D_COMPRESSED_ANIMATION,
    children: [{ id: W3D_COMPRESSED_ANIMATION_HEADER, data: header }],
  };
}

export interface SampleOptions {
  /** MESH_HEADER3 surumu. */
  readonly meshVersion?: number;
  /** Verilirse dosyaya sikistirilmis animasyon da eklenir. */
  readonly compressedAnimationVersion?: number;
}

/** Mesh, iskelet ve animasyonu tek bir dosyada birlestirir. */
export function sampleW3dFile(options: SampleOptions = {}): Uint8Array {
  const chunks: ChunkInput[] = [
    sampleMeshChunk(options.meshVersion ?? MESH_HEADER3_VERSIONS.v42),
    sampleHierarchyChunk(),
    sampleAnimationChunk(),
  ];
  if (options.compressedAnimationVersion !== undefined) {
    chunks.push(sampleCompressedAnimationChunk(options.compressedAnimationVersion));
  }
  return writeW3dChunks(chunks);
}
