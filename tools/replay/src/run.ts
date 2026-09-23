/**
 * Bassiz determinizm kosusu.
 *
 * Bu dosya render'a, DOM'a ve duvar saatine HİC dokunmaz. `@bfme/engine` ve
 * `@bfme/core-present` import edilmez — ESLint bunu zorlar. Bu aracin
 * calisabiliyor olmasi, sim'in gercekten saf oldugunun kanitidir: sim
 * tarayiciya bir bagimlilik tasisaydi burada derlenmezdi.
 *
 * `runReplay` yalnizca deterministik alanlar dondurur. Gecen sure gibi
 * kosudan kosuya degisen seyler CLI'da olculur, boylece sonuc nesnesi
 * dogrudan esitlik karsilastirmasina girebilir.
 */
import { type SimState, createSimState, formatStateHash, hashState, tick } from '@bfme/core-sim';
import { type ContentSource, formatHash, formatIssues, loadContent } from '@bfme/modloader';
import type { Content } from '@bfme/schema';
import { Scenario } from './scenario';

export interface ReplayOptions {
  readonly seed: number;
  readonly ticks: number;
  /** Yuklenecek icerik paketleri, yukleme sirasinda. */
  readonly mods: readonly string[];
  readonly source: ContentSource;
  /** Kac tick'te bir ara hash kaydedilecegi. 0 = kaydetme. */
  readonly checkpointEvery?: number;
}

export interface ReplayCheckpoint {
  readonly tick: number;
  readonly hash: string;
}

export interface ReplayResult {
  /** İcerik hash'i, sekiz haneli onaltilik. */
  readonly dataHash: string;
  /** Son durum hash'i, sekiz haneli onaltilik. */
  readonly finalStateHash: string;
  readonly ticks: number;
  readonly entityCount: number;
  readonly checkpoints: readonly ReplayCheckpoint[];
}

/** İcerik yuklenemediginde firlatilir. */
export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayError';
  }
}

/** İcerigi yukler; hata varsa okunabilir bir raporla durur. */
export function loadOrThrow(source: ContentSource, mods: readonly string[]): Content {
  const result = loadContent(source, { enabled: [...mods] });
  if (!result.ok) {
    throw new ReplayError(`İcerik yuklenemedi:\n${formatIssues(result.issues)}`);
  }
  return result.content;
}

/**
 * Simulasyonu verilen tick sayisi kadar kosar.
 *
 * Ayni secenekler her zaman ayni sonucu verir — bu aracin tek isi budur.
 */
export function runReplay(options: ReplayOptions): ReplayResult {
  if (!Number.isInteger(options.ticks) || options.ticks < 0) {
    throw new ReplayError(
      `Tick sayisi negatif olmayan tam sayi olmali, alinan ${String(options.ticks)}`,
    );
  }

  const content = loadOrThrow(options.source, options.mods);
  const scenario = new Scenario(content, options.seed);
  const state: SimState = createSimState();
  const checkpoints: ReplayCheckpoint[] = [];
  const every = options.checkpointEvery ?? 0;

  for (let i = 0; i < options.ticks; i++) {
    tick(state, scenario.next(state), content);
    if (every > 0 && state.tick % every === 0) {
      checkpoints.push({ tick: state.tick, hash: formatStateHash(hashState(state)) });
    }
  }

  return {
    dataHash: formatHash(content.dataHash),
    finalStateHash: formatStateHash(hashState(state)),
    ticks: options.ticks,
    entityCount: state.entityCount,
    checkpoints,
  };
}
