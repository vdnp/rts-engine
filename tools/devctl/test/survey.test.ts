import {
  type ChunkInput,
  MESH_HEADER3_VERSIONS,
  SUB_CHUNK_FLAG,
  isKnownChunk,
  sampleW3dFile,
  writeW3dChunks,
} from '@bfme/formats';
import { describe, expect, it } from 'vitest';
import { formatScan, formatSurvey } from '../src/scan';
import {
  type ArchiveReport,
  EXPECTED_STRIDES,
  SurveyAccumulator,
  UNKNOWN_SAMPLE_LIMIT,
  VERSIONED_CHUNK_IDS,
  entryExtension,
  rankCounts,
  sizeStats,
  suspiciousName,
} from '../src/survey';

const W3D_MESH = 0x00000000;
const W3D_VERTICES = 0x00000002;
const W3D_MESH_HEADER3 = 0x0000001f;
const W3D_TRIANGLES = 0x00000020;
const W3D_PIVOTS = 0x00000102;

/** Ters boli; kacis karmasasindan kacinmak icin. */
const BS = String.fromCharCode(92);

/** İstenen kose/ucgen sayisini bildiren bir MESH_HEADER3 govdesi. */
function meshHeader(vertexCount: number, triangleCount: number, version = 0x00040001): Uint8Array {
  const data = new Uint8Array(116);
  const view = new DataView(data.buffer);
  view.setUint32(0, version, true);
  view.setUint32(40, triangleCount, true);
  view.setUint32(44, vertexCount, true);
  return data;
}

describe('entryExtension', () => {
  it('uzantiyi kucuk harfle verir', () => {
    expect(entryExtension(`art${BS}w3d${BS}Kutu.W3D`)).toBe('w3d');
    expect(entryExtension('ini/birim.INI')).toBe('ini');
  });

  it('uzantisiz adlari isaretler', () => {
    expect(entryExtension('LEKTIONEN')).toBe('(uzantisiz)');
    expect(entryExtension(`klasor${BS}dosya`)).toBe('(uzantisiz)');
  });

  it('nokta ile baslayan adi uzanti saymaz', () => {
    expect(entryExtension('.gitignore')).toBe('(uzantisiz)');
  });
});

describe('rankCounts', () => {
  it('cok olandan aza siralar', () => {
    const counts = new Map([
      ['a', 1],
      ['b', 5],
      ['c', 3],
    ]);
    expect(rankCounts(counts)).toEqual([
      ['b', 5],
      ['c', 3],
      ['a', 1],
    ]);
  });

  it('esit sayida alfabetik siralar', () => {
    const counts = new Map([
      ['z', 2],
      ['a', 2],
    ]);
    expect(rankCounts(counts).map(([name]) => name)).toEqual(['a', 'z']);
  });
});

describe('suspiciousName', () => {
  it('kontrol karakteri ve bos adlari yakalar', () => {
    expect(suspiciousName('')).toBe(true);
    expect(suspiciousName('   ')).toBe(true);
    expect(suspiciousName('ad\u0001bozuk')).toBe(true);
    expect(suspiciousName('ad\u007f')).toBe(true);
  });

  it('normal adlari gecirir', () => {
    expect(suspiciousName(`art${BS}w3d${BS}kutu.w3d`)).toBe(false);
  });
});

describe('SurveyAccumulator', () => {
  it('chunk histogramini toplar', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add('a.w3d', sampleW3dFile());
    accumulator.add('b.w3d', sampleW3dFile());

    const report = accumulator.report();
    expect(report.fileCount).toBe(2);
    expect(report.chunkHistogram).toContainEqual(['ANIMATION_CHANNEL', 4]);
    expect(report.chunkHistogram).toContainEqual(['MESH', 2]);
  });

  it('taninmayan chunk kimliklerini ayri listeler', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add('x.w3d', writeW3dChunks([{ id: 0xdeadbeef, data: new Uint8Array(4) }]));

    const report = accumulator.report();
    expect(report.unknownChunks).toEqual([{ id: '0xdeadbeef', count: 1, sources: ['x.w3d'] }]);
  });

  it('taninmayan kimligin goruldugu dosyalari ornekler', () => {
    // Sayi tek basina yetmiyor: bir kimlik yalnizca birkac dosyada
    // gorunuyorsa o dosyalarin ADI nedeni acikliyor.
    const accumulator = new SurveyAccumulator();
    const bytes = writeW3dChunks([{ id: 0xdeadbeef, data: new Uint8Array(4) }]);
    for (let i = 0; i < UNKNOWN_SAMPLE_LIMIT + 3; i++) {
      accumulator.add(`dosya${String(i)}.w3d`, bytes);
    }

    const unknown = accumulator.report().unknownChunks[0];
    expect(unknown?.count).toBe(UNKNOWN_SAMPLE_LIMIT + 3);
    // Ornekler sinirlidir ve tekrar etmez; rapor sisirilmez.
    expect(unknown?.sources).toEqual([
      'dosya0.w3d',
      'dosya1.w3d',
      'dosya2.w3d',
      'dosya3.w3d',
      'dosya4.w3d',
    ]);
  });

  it('ayni dosyada tekrar eden taninmayan kimligi bir kez ornekler', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add(
      'x.w3d',
      writeW3dChunks([
        { id: 0xdeadbeef, data: new Uint8Array(4) },
        { id: 0xdeadbeef, data: new Uint8Array(4) },
      ]),
    );

    const unknown = accumulator.report().unknownChunks[0];
    expect(unknown?.count).toBe(2);
    expect(unknown?.sources).toEqual(['x.w3d']);
  });

  it('surum alanlarini major.minor olarak okur', () => {
    const accumulator = new SurveyAccumulator();
    const tree: ChunkInput[] = [
      {
        id: W3D_MESH,
        children: [{ id: W3D_MESH_HEADER3, data: meshHeader(0, 0, 0x00030002) }],
      },
    ];
    accumulator.add('x.w3d', writeW3dChunks(tree));
    expect(accumulator.report().versions).toEqual([['MESH_HEADER3 3.2', 1]]);
  });

  it('beklenen adimla bolunmeyen govdeyi yakalar', () => {
    const accumulator = new SurveyAccumulator();
    // VERTICES 12'nin kati olmali; 14 bayt degil.
    accumulator.add('x.w3d', writeW3dChunks([{ id: W3D_VERTICES, data: new Uint8Array(14) }]));

    const findings = accumulator.report().strideMismatches;
    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain('VERTICES');
    expect(findings[0]?.detail).toContain('12 ile bolunmuyor');
  });

  it('PIVOTS adimini da denetler', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add('x.w3d', writeW3dChunks([{ id: W3D_PIVOTS, data: new Uint8Array(61) }]));
    expect(accumulator.report().strideMismatches[0]?.detail).toContain('PIVOTS');
  });

  it('bos govdeyi adim ihlali saymaz', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add('x.w3d', writeW3dChunks([{ id: W3D_VERTICES, data: new Uint8Array(0) }]));
    expect(accumulator.report().strideMismatches).toEqual([]);
  });

  it('bildirilen kose sayisi ile govde uyusmazligini yakalar', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add(
      'x.w3d',
      writeW3dChunks([
        {
          id: W3D_MESH,
          children: [
            { id: W3D_MESH_HEADER3, data: meshHeader(10, 0) },
            // 10 kose 120 bayt olmali; 36 bayt var.
            { id: W3D_VERTICES, data: new Uint8Array(36) },
          ],
        },
      ]),
    );

    const findings = accumulator.report().countMismatches;
    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain('10 kose bildiriyor');
    expect(findings[0]?.detail).toContain('beklenen 120');
  });

  it('bildirilen ucgen sayisi ile govde uyusmazligini yakalar', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add(
      'x.w3d',
      writeW3dChunks([
        {
          id: W3D_MESH,
          children: [
            { id: W3D_MESH_HEADER3, data: meshHeader(0, 3) },
            { id: W3D_TRIANGLES, data: new Uint8Array(64) },
          ],
        },
      ]),
    );
    expect(accumulator.report().countMismatches[0]?.detail).toContain('3 ucgen bildiriyor');
  });

  it('ornek dosyamiz hicbir tutarsizlik uretmez', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add('ornek.w3d', sampleW3dFile());
    const report = accumulator.report();
    expect(report.strideMismatches).toEqual([]);
    expect(report.countMismatches).toEqual([]);
    expect(report.parseErrors).toEqual([]);
  });

  it('ayristirilamayan dosyayi hata olarak sayar, dosya sayisina katmaz', () => {
    const accumulator = new SurveyAccumulator();
    const bytes = sampleW3dFile();
    accumulator.add('kesik.w3d', bytes.subarray(0, bytes.length - 20));

    const report = accumulator.report();
    expect(report.fileCount).toBe(0);
    expect(report.parseErrors).toHaveLength(1);
    expect(report.parseErrors[0]?.source).toBe('kesik.w3d');
    expect(report.parseErrors[0]?.detail).toContain('disina tasiyor');
  });

  it('addFailure okunamayan girdiyi dogrudan kaydeder', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.addFailure('a.big!b.w3d', 'RefPack acilamadi');
    expect(accumulator.report().parseErrors).toEqual([
      { source: 'a.big!b.w3d', detail: 'RefPack acilamadi' },
    ]);
  });
});

describe('SurveyAccumulator — bayrak ve dalma', () => {
  /** Govdesi metin olan ama alt chunk bayragi kurulu bir chunk uretir. */
  function bogusContainer(id: number, text: string): Uint8Array {
    const body = Uint8Array.from(text, (c) => c.charCodeAt(0));
    const out = new Uint8Array(8 + body.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, id, true);
    view.setUint32(4, (body.length | SUB_CHUNK_FLAG) >>> 0, true);
    out.set(body, 8);
    return out;
  }

  it('dalinamayan chunk-u sayar, dosyayi hata saymaz', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add('x.w3d', bogusContainer(0x2e, 'UPerSpeed=1.0;'));

    const report = accumulator.report();
    expect(report.fileCount).toBe(1);
    expect(report.parseErrors).toEqual([]);
    expect(report.descendFailures).toEqual([['VERTEX_MAPPER_ARGS0', 1]]);
  });

  it('ayni kimlik hem kapsayici hem yaprak gorulurse bildirir', () => {
    // Gercek soru: HIERARCHY 1472 ama HIERARCHY_HEADER 1356 — bazi
    // HIERARCHY chunk-lari bayraksiz mi yazilmis? Olcen kontrol budur.
    const accumulator = new SurveyAccumulator();
    accumulator.add(
      'kapsayici.w3d',
      writeW3dChunks([{ id: 0x100, children: [{ id: 0x101, data: new Uint8Array(36) }] }]),
    );
    accumulator.add('yaprak.w3d', writeW3dChunks([{ id: 0x100, data: new Uint8Array(8) }]));

    const conflicts = accumulator.report().flagConflicts;
    expect(conflicts).toEqual([
      {
        name: 'HIERARCHY',
        asContainer: 1,
        asLeaf: 1,
        leafSizes: { min: 8, median: 8, max: 8, zeroCount: 0 },
      },
    ]);
  });

  it('yaprak gorulen orneklerin govde boyutunu olcer', () => {
    // Karar bu olcume dayanir: yapraklarin hepsi bos ise yer tutucudur,
    // boyutu varsa icinde okumadigimiz veri var demektir.
    const accumulator = new SurveyAccumulator();
    accumulator.add(
      'kapsayici.w3d',
      writeW3dChunks([{ id: 0x100, children: [{ id: 0x101, data: new Uint8Array(36) }] }]),
    );
    for (const size of [0, 0, 4, 40]) {
      accumulator.add(
        `yaprak${String(size)}.w3d`,
        writeW3dChunks([{ id: 0x100, data: new Uint8Array(size) }]),
      );
    }

    const conflict = accumulator.report().flagConflicts[0];
    expect(conflict?.asLeaf).toBe(4);
    expect(conflict?.leafSizes).toEqual({ min: 0, median: 2, max: 40, zeroCount: 2 });
  });

  it('tutarli bayrak kullaniminda catisma bildirmez', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add('a.w3d', sampleW3dFile());
    accumulator.add('b.w3d', sampleW3dFile());
    expect(accumulator.report().flagConflicts).toEqual([]);
  });

  it('Faz 1-de yorumlanmayacak chunk-lari ayrica sayar', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add(
      'x.w3d',
      writeW3dChunks([
        { id: 0x740, data: new Uint8Array(4) }, // BOX
        { id: 0x900, data: new Uint8Array(4) }, // DAZZLE
        { id: 0x0, children: [] }, // MESH — atlanacak degil
      ]),
    );
    expect(accumulator.report().skippedChunks).toBe(2);
  });
});

describe('SurveyAccumulator — surumler', () => {
  it('iki MESH_HEADER3 surumunu ayri sayar', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add('a.w3d', sampleW3dFile({ meshVersion: MESH_HEADER3_VERSIONS.v42 }));
    accumulator.add('b.w3d', sampleW3dFile({ meshVersion: MESH_HEADER3_VERSIONS.v50 }));

    const versions = accumulator.report().versions;
    expect(versions).toContainEqual(['MESH_HEADER3 4.2', 1]);
    expect(versions).toContainEqual(['MESH_HEADER3 5.0', 1]);
  });

  it('her iki surumde de sayi-govde uyusmazligi uretmez', () => {
    // Gercek veride 13159 mesh uzerinde sifir uyusmazlik cikti; fixture
    // uretecimiz de ayni davranmali.
    for (const version of [MESH_HEADER3_VERSIONS.v42, MESH_HEADER3_VERSIONS.v50]) {
      const accumulator = new SurveyAccumulator();
      accumulator.add('x.w3d', sampleW3dFile({ meshVersion: version }));
      expect(accumulator.report().countMismatches).toEqual([]);
    }
  });

  it('HLOD_HEADER surumunu dogru kimlikten okur', () => {
    // Regresyon: surum tablosu kendi etiketini tutarken isim tablosu
    // HLOD_HEADER-i 0x701-e tasidi ve buradaki eski 0xB01 girdisi kaldi.
    // Sonuc sessizdi: gercek basliklar hic orneklenmedi, alakasiz bir
    // chunk HLOD_HEADER diye cop surum raporladi.
    const body = new Uint8Array(32);
    new DataView(body.buffer).setUint32(0, (1 << 16) | 0, true); // Version 1.0
    const accumulator = new SurveyAccumulator();
    accumulator.add(
      'x.w3d',
      writeW3dChunks([{ id: 0x700, children: [{ id: 0x701, data: body }] }]),
    );

    expect(accumulator.report().versions).toEqual([['HLOD_HEADER 1.0', 1]]);
  });

  it('surumle baslamayan baslik chunk-larini orneklemez', () => {
    // Her *HeaderStruct surumle baslamaz: HLOD_SUB_OBJECT_ARRAY_HEADER
    // (0x703) ModelCount ile baslar. Listede olmamali.
    const accumulator = new SurveyAccumulator();
    accumulator.add('x.w3d', writeW3dChunks([{ id: 0x703, data: new Uint8Array(40) }]));
    expect(accumulator.report().versions).toEqual([]);
  });
});

describe('anket tablolari', () => {
  // Kimlik iki yerde yasarsa biri duzeltilip digeri unutulabiliyor —
  // HLOD_HEADER tam olarak boyle kaybolmustu. Etiketler artik
  // `chunkName()` ile uretiliyor; bu sinav da kimliklerin isim
  // tablosunda gercekten bulundugunu dogruluyor.
  it('surum tablosundaki her kimlik taninir', () => {
    for (const id of VERSIONED_CHUNK_IDS) {
      expect(isKnownChunk(id), `0x${id.toString(16)} isim tablosunda yok`).toBe(true);
    }
  });

  it('adim tablosundaki her kimlik taninir', () => {
    for (const key of Object.keys(EXPECTED_STRIDES)) {
      const id = Number(key);
      expect(isKnownChunk(id), `0x${id.toString(16)} isim tablosunda yok`).toBe(true);
    }
  });
});

describe('sizeStats', () => {
  it('bos kumede sifir dondurur', () => {
    expect(sizeStats([])).toEqual({ min: 0, median: 0, max: 0, zeroCount: 0 });
  });

  it('tek sayida olcumde ortadaki degeri verir', () => {
    expect(sizeStats([40, 4, 12])).toEqual({ min: 4, median: 12, max: 40, zeroCount: 0 });
  });

  it('cift sayida olcumde ortadaki ikisinin ortalamasini verir', () => {
    expect(sizeStats([0, 4, 8, 100])).toEqual({ min: 0, median: 6, max: 100, zeroCount: 1 });
  });

  it('girdi dizisini degistirmez', () => {
    const values = [3, 1, 2];
    sizeStats(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('formatScan', () => {
  const healthy: ArchiveReport = {
    path: '/oyun/Data/models.big',
    fileSize: 2048,
    magic: 'BIGF',
    entryCount: 3,
    sizeMatches: true,
    extensions: [
      ['w3d', 2],
      ['ini', 1],
    ],
    compressedCount: 1,
    suspicious: [],
  };

  it('arsivleri ve uzanti dagilimini yazar', () => {
    const text = formatScan(
      { archives: [healthy], totalEntries: 3, totalExtensions: healthy.extensions, failed: 0 },
      '/oyun',
    ).join('\n');
    expect(text).toContain('models.big');
    expect(text).toContain('BIGF');
    expect(text).toContain('uzanti dagilimi:');
    expect(text).toContain('toplam girdi: 3');
  });

  it('bos dizini acikca soyler', () => {
    const text = formatScan(
      { archives: [], totalEntries: 0, totalExtensions: [], failed: 0 },
      '/bos',
    ).join('\n');
    expect(text).toContain('Hic .big arsivi bulunamadi.');
  });

  it('acilamayan arsivi ve nedenini gosterir', () => {
    const broken: ArchiveReport = {
      ...healthy,
      path: '/oyun/bozuk.big',
      entryCount: 0,
      error: 'Taninmayan imza',
    };
    const text = formatScan(
      { archives: [broken], totalEntries: 0, totalExtensions: [], failed: 1 },
      '/oyun',
    ).join('\n');
    expect(text).toContain('ACILAMADI');
    expect(text).toContain('Taninmayan imza');
  });

  it('boyut uyusmazligini isaretler', () => {
    const text = formatScan(
      {
        archives: [{ ...healthy, sizeMatches: false }],
        totalEntries: 3,
        totalExtensions: [],
        failed: 0,
      },
      '/oyun',
    ).join('\n');
    expect(text).toContain('boyut uyusmuyor');
  });

  it('supheli girdileri listeler', () => {
    const text = formatScan(
      {
        archives: [{ ...healthy, suspicious: ['bos girdi: x.txt'] }],
        totalEntries: 3,
        totalExtensions: [],
        failed: 0,
      },
      '/oyun',
    ).join('\n');
    expect(text).toContain('supheli girdiler (1):');
    expect(text).toContain('bos girdi: x.txt');
  });
});

describe('formatSurvey', () => {
  function reportFor(bytes: Uint8Array) {
    const accumulator = new SurveyAccumulator();
    accumulator.add('ornek.w3d', bytes);
    return accumulator.report();
  }

  it('saglikli anketi ozetler', () => {
    const text = formatSurvey(reportFor(sampleW3dFile()), '/oyun').join('\n');
    expect(text).toContain('1 W3D ayristirildi');
    expect(text).toContain('chunk histogrami:');
    expect(text).toContain('taninmayan chunk yok.');
    expect(text).toContain('boyut tutarsizliklari (adim): yok');
    expect(text).toContain('bayrak tutarsizligi: yok');
    expect(text).toContain('MESH_HEADER3 4.2');
  });

  it('taninmayan chunk basligini vurgular', () => {
    const report = reportFor(writeW3dChunks([{ id: 0xabcdef01, data: new Uint8Array(4) }]));
    const text = formatSurvey(report, '/oyun').join('\n');
    expect(text).toContain('TANINMAYAN chunk kimlikleri (1 cesit):');
    expect(text).toContain('0xabcdef01');
    // Kimligin nerede goruldugu raporda yazmali.
    expect(text).toContain('ornek dosyalar');
    expect(text).toContain('ornek.w3d');
  });

  it('bayrak catismasinda yaprak boyut istatistigini yazar', () => {
    const accumulator = new SurveyAccumulator();
    accumulator.add(
      'kapsayici.w3d',
      writeW3dChunks([{ id: 0x100, children: [{ id: 0x101, data: new Uint8Array(36) }] }]),
    );
    accumulator.add('yaprak.w3d', writeW3dChunks([{ id: 0x100, data: new Uint8Array(24) }]));

    const text = formatSurvey(accumulator.report(), '/oyun').join('\n');
    expect(text).toContain('BAYRAK TUTARSIZLIGI (1 chunk):');
    expect(text).toContain('medyan');
    expect(text).toContain('0/1');
  });

  it('bos dizini acikca soyler', () => {
    const text = formatSurvey(new SurveyAccumulator().report(), '/bos').join('\n');
    expect(text).toContain('Hic W3D dosyasi bulunamadi.');
  });

  it('ayristirma hatalarini kaynagiyla listeler', () => {
    const bytes = sampleW3dFile();
    const report = reportFor(bytes.subarray(0, bytes.length - 20));
    const text = formatSurvey(report, '/oyun').join('\n');
    expect(text).toContain('ayristirma hatalari (1):');
    expect(text).toContain('ornek.w3d');
  });
});
