/**
 * W3D chunk kimlik adlari.
 *
 * KAYNAKLAR (ikisi de acik kaynak, decompile edilmis kod DEGIL):
 *
 *  1. Westwood'un `w3d_file.h` basligi — orijinal chunk enum'u. Topluluk
 *     depolarinda serbestce dolasan, Westwood'un kendi yayinladigi baslik.
 *  2. OpenSAGE Docs, `file-formats/w3d/index.rst` — SAGE motorunun (Generals,
 *     BFME) ekledigi chunk'lar.
 *
 * Tablo ikisinin BIRLESIMIDIR. Once tam Westwood kumesi, ustune SAGE
 * eklemeleri.
 *
 * ÇELISKI: OpenSAGE belgesi emitter keyframe chunk'larini 0x510-0x512 olarak
 * listeliyor, Westwood basligi 0x50A-0x50C diyor. Gercek kurulumda gozlenen
 * taninmayan kimlikler 0x501-0x50D araliginda toplandigi icin Westwood
 * degerleri kullanildi. 0x50D hicbir kaynakta yok; isim UYDURULMADI,
 * onaltilik gorunmeye devam edecek.
 *
 * Bu tablo yalnizca okunabilirlik icindir; ayristirma kimlikten bagimsiz
 * calisir (chunk boyutu ve alt chunk bayragi yeterlidir).
 */

export const W3D_CHUNK_NAMES: Readonly<Record<number, string>> = {
  // ── Mesh ──────────────────────────────────────────────────────────────
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
  0x00000025: 'PRELIT_LIGHTMAP_MULTI_PASS',
  0x00000026: 'PRELIT_LIGHTMAP_MULTI_TEXTURE',

  // ── Malzeme ve doku ───────────────────────────────────────────────────
  0x00000028: 'MATERIAL_INFO',
  0x00000029: 'SHADERS',
  0x0000002a: 'VERTEX_MATERIALS',
  0x0000002b: 'VERTEX_MATERIAL',
  0x0000002c: 'VERTEX_MATERIAL_NAME',
  0x0000002d: 'VERTEX_MATERIAL_INFO',
  // Metin tasir; alt chunk icermez.
  0x0000002e: 'VERTEX_MAPPER_ARGS0',
  0x0000002f: 'VERTEX_MAPPER_ARGS1',
  0x00000030: 'TEXTURES',
  0x00000031: 'TEXTURE',
  0x00000032: 'TEXTURE_NAME',
  0x00000033: 'TEXTURE_INFO',
  0x00000038: 'MATERIAL_PASS',
  0x00000039: 'VERTEX_MATERIAL_IDS',
  0x0000003a: 'SHADER_IDS',
  0x0000003b: 'DCG',
  0x0000003c: 'DIG',
  0x0000003e: 'SCG',
  0x0000003f: 'SHADER_MATERIAL_ID', // SAGE eklemesi
  0x00000048: 'TEXTURE_STAGE',
  0x00000049: 'TEXTURE_IDS',
  0x0000004a: 'STAGE_TEXCOORDS', // UV koordinatlari
  0x0000004b: 'PER_FACE_TEXCOORD_IDS',

  // ── Shader malzemeleri (SAGE eklemesi) ────────────────────────────────
  0x00000050: 'SHADER_MATERIALS',
  0x00000051: 'SHADER_MATERIAL',
  0x00000052: 'SHADER_MATERIAL_HEADER',
  0x00000053: 'SHADER_MATERIAL_PROPERTY',

  // ── Deform ────────────────────────────────────────────────────────────
  0x00000058: 'DEFORM',
  0x00000059: 'DEFORM_SET',
  0x0000005a: 'DEFORM_KEYFRAME',
  0x0000005b: 'DEFORM_DATA',

  // ── Teget uzaylari (SAGE eklemesi) ────────────────────────────────────
  0x00000060: 'TANGENTS',
  0x00000061: 'BITANGENTS',

  0x00000080: 'PS2_SHADERS',

  // ── Carpisma agaci ────────────────────────────────────────────────────
  0x00000090: 'AABTREE',
  0x00000091: 'AABTREE_HEADER',
  0x00000092: 'AABTREE_POLYINDICES',
  0x00000093: 'AABTREE_NODES',

  // ── Iskelet ───────────────────────────────────────────────────────────
  0x00000100: 'HIERARCHY',
  0x00000101: 'HIERARCHY_HEADER',
  0x00000102: 'PIVOTS',
  0x00000103: 'PIVOT_FIXUPS',

  // ── Animasyon ─────────────────────────────────────────────────────────
  0x00000200: 'ANIMATION',
  0x00000201: 'ANIMATION_HEADER',
  0x00000202: 'ANIMATION_CHANNEL',
  0x00000203: 'BIT_CHANNEL',

  0x00000280: 'COMPRESSED_ANIMATION',
  0x00000281: 'COMPRESSED_ANIMATION_HEADER',
  0x00000282: 'COMPRESSED_ANIMATION_CHANNEL',
  0x00000283: 'COMPRESSED_BIT_CHANNEL',
  0x00000284: 'COMPRESSED_ANIMATION_MOTION_CHANNEL', // BFME II eklemesi

  0x000002c0: 'MORPH_ANIMATION',
  0x000002c1: 'MORPHANIM_HEADER',
  0x000002c2: 'MORPHANIM_CHANNEL',
  0x000002c3: 'MORPHANIM_POSENAME',
  0x000002c4: 'MORPHANIM_KEYDATA',
  0x000002c5: 'MORPHANIM_PIVOTCHANNELDATA',

  // ── Hiyerarsik model ──────────────────────────────────────────────────
  0x00000300: 'HMODEL',
  0x00000301: 'HMODEL_HEADER',
  0x00000302: 'NODE',
  0x00000303: 'COLLISION_NODE',
  0x00000304: 'SKIN_NODE',
  0x00000305: 'OBSOLETE_HMODEL_AUX_DATA',
  0x00000306: 'OBSOLETE_SHADOW_NODE',

  0x00000400: 'LODMODEL',
  0x00000401: 'LODMODEL_HEADER',
  0x00000402: 'LOD',

  0x00000420: 'COLLECTION',
  0x00000421: 'COLLECTION_HEADER',
  0x00000422: 'COLLECTION_OBJ_NAME',
  0x00000423: 'PLACEHOLDER',
  0x00000424: 'TRANSFORM_NODE',

  0x00000440: 'POINTS',

  // ── Isik ──────────────────────────────────────────────────────────────
  0x00000460: 'LIGHT',
  0x00000461: 'LIGHT_INFO',
  0x00000462: 'SPOT_LIGHT_INFO',
  0x00000463: 'NEAR_ATTENUATION',
  0x00000464: 'FAR_ATTENUATION',

  // ── Parcacik yayici ───────────────────────────────────────────────────
  0x00000500: 'EMITTER',
  0x00000501: 'EMITTER_HEADER',
  0x00000502: 'EMITTER_USER_DATA',
  0x00000503: 'EMITTER_INFO',
  0x00000504: 'EMITTER_INFOV2',
  0x00000505: 'EMITTER_PROPS',
  0x00000506: 'OBSOLETE_EMITTER_COLOR_KEYFRAME',
  0x00000507: 'OBSOLETE_EMITTER_OPACITY_KEYFRAME',
  0x00000508: 'OBSOLETE_EMITTER_SIZE_KEYFRAME',
  0x00000509: 'EMITTER_LINE_PROPERTIES',
  0x0000050a: 'EMITTER_ROTATION_KEYFRAMES',
  0x0000050b: 'EMITTER_FRAME_KEYFRAMES',
  0x0000050c: 'EMITTER_BLUR_TIME_KEYFRAMES',

  // ── Toplam nesne ──────────────────────────────────────────────────────
  0x00000600: 'AGGREGATE',
  0x00000601: 'AGGREGATE_HEADER',
  0x00000602: 'AGGREGATE_INFO',
  0x00000603: 'TEXTURE_REPLACER_INFO',
  0x00000604: 'AGGREGATE_CLASS_INFO',

  // ── HLOD: mesh'leri iskelete baglayan aile ────────────────────────────
  0x00000700: 'HLOD',
  0x00000701: 'HLOD_HEADER',
  0x00000702: 'HLOD_LOD_ARRAY',
  0x00000703: 'HLOD_SUB_OBJECT_ARRAY_HEADER',
  0x00000704: 'HLOD_SUB_OBJECT',
  0x00000705: 'HLOD_AGGREGATE_ARRAY',
  0x00000706: 'HLOD_PROXY_ARRAY',

  // ── Basit cizim nesneleri ─────────────────────────────────────────────
  0x00000740: 'BOX',
  0x00000741: 'SPHERE',
  0x00000742: 'RING',
  0x00000750: 'NULL_OBJECT',

  0x00000800: 'LIGHTSCAPE',
  0x00000801: 'LIGHTSCAPE_LIGHT',
  0x00000802: 'LIGHT_TRANSFORM',

  0x00000900: 'DAZZLE',
  0x00000901: 'DAZZLE_NAME',
  0x00000902: 'DAZZLE_TYPENAME',

  0x00000a00: 'SOUNDROBJ',
  0x00000a01: 'SOUNDROBJ_HEADER',
  0x00000a02: 'SOUNDROBJ_DEFINITION',

  // ── BFME eklemeleri ───────────────────────────────────────────────────
  // OpenSAGE belgesi "amaci bilinmiyor, BFME'de eklendi" diyor. Isimlerine
  // bakilirsa ikinci bir kose/normal kumesi; mesh cikarma diliminde
  // gercek govdeleri incelenecek. ATLANACAK BIR SEY DEGIL.
  0x00000c00: 'VERTICES_2',
  0x00000c01: 'VERTEX_NORMALS_2',
};

/**
 * Faz 1'de govdesi YORUMLANMAYACAK chunk aileleri.
 *
 * Taninirlar ve agacta gorunurler; yalnizca icerikleri cozulmez. Mesh,
 * iskelet ve animasyon disindaki her sey su an bu kapsamda.
 */
export const NOT_INTERPRETED_IN_PHASE1: readonly number[] = [
  0x00000090,
  0x00000091,
  0x00000092,
  0x00000093, // AABTREE
  0x00000500,
  0x00000501,
  0x00000502,
  0x00000503,
  0x00000504,
  0x00000505,
  0x00000506,
  0x00000507,
  0x00000508,
  0x00000509,
  0x0000050a,
  0x0000050b,
  0x0000050c, // emitter
  0x00000740,
  0x00000741,
  0x00000742, // box / sphere / ring
  0x00000900,
  0x00000901,
  0x00000902, // dazzle
  0x00000284, // compressed animation motion channel — animasyon dilimine
];

/** Chunk kimliginin okunabilir adi. Taninmiyorsa onaltilik gosterilir. */
export function chunkName(id: number): string {
  return W3D_CHUNK_NAMES[id] ?? `UNKNOWN_0x${id.toString(16).padStart(8, '0')}`;
}

/** Kimligin tabloda bulunup bulunmadigi. */
export function isKnownChunk(id: number): boolean {
  return W3D_CHUNK_NAMES[id] !== undefined;
}
