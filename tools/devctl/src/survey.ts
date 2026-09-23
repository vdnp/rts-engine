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

/** Govde boyutunun tam bolunmesi beklenen chunk'lar. */
export const EXPECTED_STRIDES: Readonly<Record<number, { stride: number; label: string }>> = {
  0x00000002: { stride: 12, label: 'VERTICES (3 float)' },
  0x00000003: { stride: 12, label: 'VERTEX_NORMALS (3 float)' },
  0x00000020: { stride: 32, label: 'TRIANGLES (W3dTriStruct)' },
  0x00000102: { stride: 60, label: 'PIVOTS (W3dPivotStruct)' },
};

/** Ilk dort bayti surum alani olan chunk'lar. */
export const VERSIONED_CHUNKS: Readonly<Record<number, string>> = {
  0x0000001f: 'MESH_HEADER3',
  0x00000101: 'HIERARCHY_HEADER',
  0x00000201: 'ANIMATION_HEADER',
  0x00000281: 'COMPRESSED_ANIMATION_HEADER',
  0x00000b01: 'HLOD_HEADER',
};

export interface SurveyFinding {
  /** Bulgunun gorundugu dosya (arsiv icindeyse `arsiv!girdi`). */
  readonly source: string;
  readonly detail: string;
}

export interface SurveyReport {
  /** Incelenen W3D dosyasi sayisi. */
  readonly fileCount: number;
  /** Ayristirilamayan dosyalar. */
  readonly parseErrors: readonly SurveyFinding[];
  /** Chunk adi -> gorulme sayisi, cok olandan aza. */
  readonly chunkHistogram: readonly (readonly [string, number])[];
  /** Tabloda olmayan chunk kimlikleri, onaltilik. */
  readonly unknownChunks: readonly (readonly [string, number])[];
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
  /**
   * BAYRAK TUTARSIZLIGI: ayni chunk kimliginin hem kapsayici hem yaprak
   * olarak gorulmesi. Bir kimlik her zaman ayni sekilde yazilmali; ikisi
   * birden gorunuyorsa ya yazici tutarsiz ya da okumamiz yanlis.
   *
   * `[ad, kapsayici sayisi, yaprak sayisi]`.
   */
  readonly flagConflicts: readonly (readonly [string, number, number])[];
  /** Faz 1'de govdesi yorumlanmayacagi bilinen chunk sayisi. */
  readonly skippedChunks: number;
}

/** Anket sirasinda biriken sayaclar. */
export class SurveyAccumulator {
  private files = 0;
  private readonly chunks = new Map<string, number>();
  private readonly unknown = new Map<string, number>();
  private readonly versions = new Map<string, number>();
  private readonly strideIssues: SurveyFinding[] = [];
  private readonly countIssues: SurveyFinding[] = [];
  private readonly errors: SurveyFinding[] = [];
  private readonly failedDescents = new Map<string, number>();
  private readonly asContainer = new Map<string, number>();
  private readonly asLeaf = new Map<string, number>();
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

      if (!isKnownChunk(chunk.id)) {
        const key = `0x${chunk.id.toString(16).padStart(8, '0')}`;
        this.unknown.set(key, (this.unknown.get(key) ?? 0) + 1);
      }

      if (SKIPPED_IDS.has(chunk.id)) this.skipped += 1;

      // Bayrak kullaniminin tutarli olup olmadigini olc: ayni kimlik hem
      // kapsayici hem yaprak gorunuyorsa bir yerde sorun var.
      const tally = chunk.hasSubChunks ? this.asContainer : this.asLeaf;
      tally.set(chunk.name, (tally.get(chunk.name) ?? 0) + 1);

      if (chunk.descendFailed !== undefined) {
        this.failedDescents.set(chunk.name, (this.failedDescents.get(chunk.name) ?? 0) + 1);
      }

      this.checkStride(source, chunk);
      this.recordVersion(chunk);
    }

    this.checkMeshCounts(source, tree);
  }

  private checkStride(source: string, chunk: W3dChunk): void {
    const expected = EXPECTED_STRIDES[chunk.id];
    if (expected === undefined || chunk.size === 0) return;
    if (chunk.size % expected.stride === 0) return;
    this.strideIssues.push({
      source,
      detail: `${expected.label}: ${String(chunk.size)} bayt, ${String(expected.stride)} ile bolunmuyor`,
    });
  }

  private recordVersion(chunk: W3dChunk): void {
    const label = VERSIONED_CHUNKS[chunk.id];
    if (label === undefined || chunk.data.length < 4) return;
    const raw = new DataView(chunk.data.buffer, chunk.data.byteOffset, 4).getUint32(0, true);
    const key = `${label} ${String(raw >>> 16)}.${String(raw & 0xffff)}`;
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
    const conflicts: [string, number, number][] = [];
    for (const [name, containerCount] of this.asContainer) {
      const leafCount = this.asLeaf.get(name) ?? 0;
      if (leafCount > 0) conflicts.push([name, containerCount, leafCount]);
    }
    conflicts.sort((a, b) => b[1] + b[2] - (a[1] + a[2]));

    return {
      fileCount: this.files,
      parseErrors: this.errors,
      chunkHistogram: rankCounts(this.chunks),
      unknownChunks: rankCounts(this.unknown),
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
