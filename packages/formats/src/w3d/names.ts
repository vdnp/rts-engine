/**
 * W3D chunk kimlik adlari.
 *
 * Topluluk belgelerinden derlenmistir ve EKSIK OLABILIR. Taninmayan bir
 * kimlik uydurulmaz, onaltilik olarak gosterilir: yanlis bir ad, yanlis bir
 * varsayimi gorunmez kilar.
 *
 * Bu tablo yalnizca okunabilirlik icindir; ayristirma kimlikten bagimsiz
 * calisir (chunk boyutu ve alt chunk bayragi yeterlidir).
 */

export const W3D_CHUNK_NAMES: Readonly<Record<number, string>> = {
  0x00000000: 'MESH',
  0x00000002: 'VERTICES',
  0x00000003: 'VERTEX_NORMALS',
  0x0000000c: 'MESH_USER_TEXT',
  0x0000000e: 'VERTEX_INFLUENCES',
  0x0000001f: 'MESH_HEADER3',
  0x00000020: 'TRIANGLES',
  0x00000022: 'VERTEX_SHADE_INDICES',
  0x00000023: 'PRELIT_UNLIT',
  0x00000024: 'PRELIT_VERTEX',
  0x00000028: 'MATERIAL_INFO',
  0x00000029: 'SHADERS',
  0x0000002a: 'VERTEX_MATERIALS',
  0x0000002c: 'VERTEX_MATERIAL',
  0x0000002d: 'VERTEX_MATERIAL_NAME',
  0x0000002e: 'VERTEX_MATERIAL_INFO',
  0x00000030: 'TEXTURES',
  0x00000031: 'TEXTURE',
  0x00000032: 'TEXTURE_NAME',
  0x00000033: 'TEXTURE_INFO',
  0x00000038: 'MATERIAL_PASS',
  0x00000039: 'VERTEX_MATERIAL_IDS',
  0x0000003a: 'SHADER_IDS',
  0x0000003b: 'DCG',
  0x0000003e: 'TEXTURE_STAGE',
  0x0000003f: 'TEXTURE_IDS',
  0x00000040: 'STAGE_TEXCOORDS',

  0x00000100: 'HIERARCHY',
  0x00000101: 'HIERARCHY_HEADER',
  0x00000102: 'PIVOTS',
  0x00000103: 'PIVOT_FIXUPS',

  0x00000200: 'ANIMATION',
  0x00000201: 'ANIMATION_HEADER',
  0x00000202: 'ANIMATION_CHANNEL',
  0x00000203: 'BIT_CHANNEL',

  0x00000280: 'COMPRESSED_ANIMATION',
  0x00000281: 'COMPRESSED_ANIMATION_HEADER',
  0x00000282: 'COMPRESSED_ANIMATION_CHANNEL',
  0x00000283: 'COMPRESSED_BIT_CHANNEL',

  0x00000300: 'MORPH_ANIMATION',
  0x00000400: 'HMODEL',
  0x00000500: 'LODMODEL',
  0x00000600: 'COLLECTION',
  0x00000700: 'POINTS',
  0x00000800: 'LIGHT',
  0x00000900: 'EMITTER',
  0x00000a00: 'AGGREGATE',

  0x00000b00: 'HLOD',
  0x00000b01: 'HLOD_HEADER',
  0x00000b02: 'HLOD_LOD_ARRAY',
  0x00000b03: 'HLOD_SUB_OBJECT_ARRAY_HEADER',
  0x00000b04: 'HLOD_SUB_OBJECT',

  0x00000c00: 'BOX',
  0x00000d00: 'SPHERE',
  0x00000e00: 'RING',
  0x00000f00: 'NULL_OBJECT',
  0x00001000: 'LIGHTSCAPE',
  0x00001100: 'DAZZLE',
  0x00001200: 'SOUNDROBJ',
};

/** Chunk kimliginin okunabilir adi. Taninmiyorsa onaltilik gosterilir. */
export function chunkName(id: number): string {
  return W3D_CHUNK_NAMES[id] ?? `UNKNOWN_0x${id.toString(16).padStart(8, '0')}`;
}

/** Kimligin tabloda bulunup bulunmadigi. */
export function isKnownChunk(id: number): boolean {
  return W3D_CHUNK_NAMES[id] !== undefined;
}
