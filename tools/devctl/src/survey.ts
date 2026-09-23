/**
 * Gercek oyun dosyalarina karsi dogrulama.
 *
 * Fixture round-trip'i, ayristirici ile yazicinin BIRBIRIYLE tutarli
 * oldugunu kanitlar — EA'nin dosyalariyla tutarli oldugunu DEGIL. Bu kor
 * noktayi kapatmak icin oyuncunun kendi kurulumundaki arsivler taranir ve
 * varsayimlarimizin gercekte tuttugu olculur.
 *
 * Buradan hicbir asset veya rapor depoya girmez; cikti stdout'a yazilir.
 */
import {
  NOT_INTERPRETED_IN_PHASE1,
  type W3dChunk,
  W3dError,
  chunkName,
  isKnownChunk,
  parseW3dChunks,
  walkChunks,
} from '@bfme/formats';

const SKIPPED_IDS = new Set(NOT_INTERPRETED_IN_PHASE1);

// ── Arsiv taramasi ──────────────────────────────────────────────────────

export interface ArchiveReport {
  readonly path: string;
  readonly fileSize: number;
  readonly magic: string;
  readonly entryCount: number;
  /** Baslikta bildirilen boyut ile gercek dosya boyutu ayni mi. */
  readonly sizeMatches: boolean;
  /** Uzanti -> girdi sayisi, cok olandan aza. */
  readonly extensions: readonly (readonly [string, number])[];
  /** RefPack imzasi tasiyan girdi sayisi. */
  readonly compressedCount: number;
  /** Supheli girdiler: bos, cok buyuk veya adi bozuk. */
  readonly suspicious: readonly string[];
  /** Arsiv hic acilamadiysa nedeni. */
  readonly error?: string;
}

export interface ScanSummary {
  readonly archives: readonly ArchiveReport[];
  readonly totalEntries: number;
  readonly totalExtensions: readonly (readonly [string, number])[];
  readonly failed: number;
}

/** Girdi adinin uzantisi; yoksa `(uzantisiz)`. */
export function entryExtension(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? name;
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '(uzantisiz)' : base.slice(dot + 1).toLowerCase();
}

/** Sayim haritasini cok olandan aza siralar. */
export function rankCounts(counts: ReadonlyMap<string, number>): (readonly [string, number])[] {
  return [...counts.entries()].sort((a, b) =>
    b[1] - a[1] !== 0 ? b[1] - a[1] : a[0] < b[0] ? -1 : 1,
  );
}

/** Adin supheli olup olmadigi: kontrol karakteri veya bos. */
export function suspiciousName(name: string): boolean {
  if (name.trim() === '') return true;
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

// ── W3D anketi ──────────────────────────────────────────────────────────

/*
 * Asagidaki iki tablo yalnizca KIMLIK tutar; etiketler `chunkName()` ile
 * uretilir.
 *
 * Bir zamanlar etiketi de burada yaziyorlardi ve beklenen sey oldu: isim
 * tablosu duzeltilip HLOD_HEADER 0x701'e tasindiginda buradaki eski 0xB01
 * girdisi unutuldu. Sonuc: gercek 1880 HLOD_HEADER hic orneklenmedi, onun
 * yerine alakasiz ve nadir bir chunk HLOD_HEADER diye etiketlenip ilk dort
 * bayti cop bir surum olarak raporlandi. Kimlik tek yerde yasarsa bu kayma
 * bir daha olamaz; `test/survey.test.ts` ayrica her kimligin isim
 * tablosunda bulundugunu sinar.
 */

/** Govde boyutunun tam bolunmesi beklenen chunk'lar: kimlik -> adim. */
export const EXPECTED_STRIDES: Readonly<Record<number, number>> = {
  0x00000002: 12, // VERTICES — 3 float
  0x00000003: 12, // VERTEX_NORMALS — 3 float
  0x00000020: 32, // TRIANGLES — W3dTriStruct
  0x00000102: 60, // PIVOTS — W3dPivotStruct
};

/**
 * Govdesi `uint32 Version` ile BASLAYAN chunk'lar.
 *
 * Her `*HeaderStruct` surumle baslamaz: `W3dHLodArrayHeaderStruct` (0x703)
 * `ModelCount` ile baslar, bu yuzden listede YOKTUR.
 *
 * Dogrulanmis duzenler (Westwood w3d_file.h):
 *   HLOD_HEADER       Version, LodCount, Name[16], HierarchyName[16]  (32 bayt)
 *   HIERARCHY_HEADER  Version, Name[16], NumPivots, Center            (36 bayt)
 */
export const VERSIONED_CHUNK_IDS: readonly number[] = [
  0x0000001f, // MESH_HEADER3
  0x00000101, // HIERARCHY_HEADER
  0x00000201, // ANIMATION_HEADER
  0x00000281, // COMPRESSED_ANIMATION_HEADER
  0x00000701, // HLOD_HEADER
];

const VERSIONED_IDS = new Set(VERSIONED_CHUNK_IDS);

export interface SurveyFinding {
  /** Bulgunun gorundugu dosya (arsiv icindeyse `arsiv!girdi`). */
  readonly source: string;
  readonly detail: string;
}

/** Taninmayan bir kimlik icin en fazla kac ornek dosya adi saklanir. */
export const UNKNOWN_SAMPLE_LIMIT = 5;

/**
 * Tabloda bulunmayan bir chunk kimligi ve nerede gorundugu.
 *
 * Ornek dosya adlari sayidan daha cok sey soyler: bir kimlik yalnizca birkac
 * dosyada gorunuyorsa o dosyalarin adi genelde nedeni aciklar — normal bir
 * model olmayabilirler.
 */
export interface UnknownChunk {
  /** Onaltilik kimlik. */
  readonly id: string;
  readonly count: number;
  readonly sources: readonly string[];
}

/** Bir olcum kumesinin min/medyan/maks degerleri ve sifir sayisi. */
export interface SizeStats {
  readonly min: number;
  readonly median: number;
  readonly max: number;
  /** Kac olcum sifir. */
  readonly zeroCount: number;
}

/**
 * Ayni chunk kimliginin hem kapsayici hem yaprak gorulmesi.
 *
 * Yaprak orneklerin GOVDE BOYUTU karari belirler: hepsi bos ise yer
 * tutucudur, gormezden gelinebilir. Boyutu varsa icinde okunmayan gercek
 * veri var demektir; o kimlige bayraga bakmadan dalmak gerekir.
 */
export interface FlagConflict {
  readonly name: string;
  readonly asContainer: number;
  readonly asLeaf: number;
  readonly leafSizes: SizeStats;
}

export interface SurveyReport {
  /** Incelenen W3D dosyasi sayisi. */
  readonly fileCount: number;
  /** Ayristirilamayan dosyalar. */
  readonly parseErrors: readonly SurveyFinding[];
  /** Chunk adi -> gorulme sayisi, cok olandan aza. */
  readonly chunkHistogram: readonly (readonly [string, number])[];
  /** Tabloda olmayan chunk kimlikleri ve ornek dosyalari. */
  readonly unknownChunks: readonly UnknownChunk[];
  /** `chunk surum` -> gorulme sayisi. */
  readonly versions: readonly (readonly [string, number])[];
  /** Beklenen adimla bolunmeyen govdeler. */
  readonly strideMismatches: readonly SurveyFinding[];
  /** Bildirilen sayilarla govde boyutunun uyusmadigi yerler. */
  readonly countMismatches: readonly SurveyFinding[];
  /**
   * Alt chunk bayragi kurulu olup govdesi cozulemeyen chunk'lar.
   * Dosya atilmaz, yaprak kabul edilir; sayisi burada gorunur.
   */
  readonly descendFailures: readonly (readonly [string, number])[];
  /** Bayrak tutarsizligi olan chunk'lar ve yaprak boyut istatistikleri. */
  readonly flagConflicts: readonly FlagConflict[];
  /** Faz 1'de govdesi yorumlanmayacagi bilinen chunk sayisi. */
  readonly skippedChunks: number;
}

/** Olcum dizisinden min/medyan/maks ve sifir sayisi. */
export function sizeStats(values: readonly number[]): SizeStats {
  if (values.length === 0) return { min: 0, median: 0, max: 0, zeroCount: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  const median =
    sorted.length % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;

  let zeroCount = 0;
  for (const value of values) if (value === 0) zeroCount += 1;

  return {
    min: sorted[0] ?? 0,
    median,
    max: sorted[sorted.length - 1] ?? 0,
    zeroCount,
  };
}

/** Anket sirasinda biriken sayaclar. */
export class SurveyAccumulator {
  private files = 0;
  private readonly chunks = new Map<string, number>();
  private readonly unknownCounts = new Map<string, number>();
  private readonly unknownSources = new Map<string, string[]>();
  private readonly versions = new Map<string, number>();
  private readonly strideIssues: SurveyFinding[] = [];
  private readonly countIssues: SurveyFinding[] = [];
  private readonly errors: SurveyFinding[] = [];
  private readonly failedDescents = new Map<string, number>();
  private readonly asContainer = new Map<string, number>();
  private readonly asLeaf = new Map<string, number>();
  private readonly leafSizes = new Map<string, number[]>();
  private skipped = 0;

  /** Okunamayan bir girdiyi dogrudan hata olarak kaydeder. */
  addFailure(source: string, detail: string): void {
    this.errors.push({ source, detail });
  }

  /** Bir W3D dosyasini isler. Ayristirilamazsa hata olarak kaydedilir. */
  add(source: string, bytes: Uint8Array): void {
    let tree: W3dChunk[];
    try {
      tree = parseW3dChunks(bytes);
    } catch (error) {
      this.errors.push({
        source,
        detail: error instanceof W3dError ? error.message : String(error),
      });
      return;
    }

    this.files += 1;
    for (const chunk of walkChunks(tree)) {
      this.chunks.set(chunk.name, (this.chunks.get(chunk.name) ?? 0) + 1);

      if (!isKnownChunk(chunk.id)) this.recordUnknown(source, chunk.id);
      if (SKIPPED_IDS.has(chunk.id)) this.skipped += 1;

      // Bayrak kullaniminin tutarli olup olmadigini olc: ayni kimlik hem
      // kapsayici hem yaprak gorunuyorsa bir yerde sorun var.
      if (chunk.hasSubChunks) {
        this.asContainer.set(chunk.name, (this.asContainer.get(chunk.name) ?? 0) + 1);
      } else {
        this.asLeaf.set(chunk.name, (this.asLeaf.get(chunk.name) ?? 0) + 1);
        // Yaprak govde boyutlari saklanir: karar bunlarin dagilimina bakar.
        const sizes = this.leafSizes.get(chunk.name);
        if (sizes === undefined) this.leafSizes.set(chunk.name, [chunk.size]);
        else sizes.push(chunk.size);
      }

      if (chunk.descendFailed !== undefined) {
        this.failedDescents.set(chunk.name, (this.failedDescents.get(chunk.name) ?? 0) + 1);
      }

      this.checkStride(source, chunk);
      this.recordVersion(chunk);
    }

    this.checkMeshCounts(source, tree);
  }

  /** Taninmayan kimligi sayar ve ilk birkac ornek dosyayi saklar. */
  private recordUnknown(source: string, id: number): void {
    const key = `0x${id.toString(16).padStart(8, '0')}`;
    this.unknownCounts.set(key, (this.unknownCounts.get(key) ?? 0) + 1);

    const sources = this.unknownSources.get(key);
    if (sources === undefined) {
      this.unknownSources.set(key, [source]);
    } else if (sources.length < UNKNOWN_SAMPLE_LIMIT && !sources.includes(source)) {
      sources.push(source);
    }
  }

  private checkStride(source: string, chunk: W3dChunk): void {
    const stride = EXPECTED_STRIDES[chunk.id];
    if (stride === undefined || chunk.size === 0) return;
    if (chunk.size % stride === 0) return;
    this.strideIssues.push({
      source,
      detail: `${chunk.name}: ${String(chunk.size)} bayt, ${String(stride)} ile bolunmuyor`,
    });
  }

  private recordVersion(chunk: W3dChunk): void {
    if (!VERSIONED_IDS.has(chunk.id) || chunk.data.length < 4) return;
    const raw = new DataView(chunk.data.buffer, chunk.data.byteOffset, 4).getUint32(0, true);
    const key = `${chunk.name} ${String(raw >>> 16)}.${String(raw & 0xffff)}`;
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
  }

  /**
   * MESH_HEADER3'te bildirilen kose ve ucgen sayilari, govdelerin gercek
   * boyutuyla tutuyor mu. Varsayimlarimizin en dogrudan sinavi budur.
   */
  private checkMeshCounts(source: string, tree: readonly W3dChunk[]): void {
    for (const mesh of walkChunks(tree)) {
      if (mesh.id !== 0x00000000 || mesh.children.length === 0) continue;

      const header = mesh.children.find((child) => child.id === 0x0000001f);
      if (header === undefined || header.data.length < 48) continue;
      const view = new DataView(header.data.buffer, header.data.byteOffset, header.data.length);
      const triangleCount = view.getUint32(40, true);
      const vertexCount = view.getUint32(44, true);

      const vertices = mesh.children.find((child) => child.id === 0x00000002);
      if (vertices !== undefined && vertices.size !== vertexCount * 12) {
        this.countIssues.push({
          source,
          detail:
            `MESH_HEADER3 ${String(vertexCount)} kose bildiriyor ama VERTICES ` +
            `${String(vertices.size)} bayt (beklenen ${String(vertexCount * 12)})`,
        });
      }

      const triangles = mesh.children.find((child) => child.id === 0x00000020);
      if (triangles !== undefined && triangles.size !== triangleCount * 32) {
        this.countIssues.push({
          source,
          detail:
            `MESH_HEADER3 ${String(triangleCount)} ucgen bildiriyor ama TRIANGLES ` +
            `${String(triangles.size)} bayt (beklenen ${String(triangleCount * 32)})`,
        });
      }
    }
  }

  report(): SurveyReport {
    const conflicts: FlagConflict[] = [];
    for (const [name, containerCount] of this.asContainer) {
      const leafCount = this.asLeaf.get(name) ?? 0;
      if (leafCount === 0) continue;
      conflicts.push({
        name,
        asContainer: containerCount,
        asLeaf: leafCount,
        leafSizes: sizeStats(this.leafSizes.get(name) ?? []),
      });
    }
    conflicts.sort((a, b) => b.asContainer + b.asLeaf - (a.asContainer + a.asLeaf));

    const unknown = rankCounts(this.unknownCounts).map<UnknownChunk>(([id, count]) => ({
      id,
      count,
      sources: this.unknownSources.get(id) ?? [],
    }));

    return {
      fileCount: this.files,
      parseErrors: this.errors,
      chunkHistogram: rankCounts(this.chunks),
      unknownChunks: unknown,
      versions: rankCounts(this.versions),
      strideMismatches: this.strideIssues,
      countMismatches: this.countIssues,
      descendFailures: rankCounts(this.failedDescents),
      flagConflicts: conflicts,
      skippedChunks: this.skipped,
    };
  }
}

/** Chunk kimliginden okunabilir etiket; rapor basliklari icin. */
export function labelFor(id: number): string {
  return `${chunkName(id)} (0x${id.toString(16).padStart(8, '0')})`;
}
