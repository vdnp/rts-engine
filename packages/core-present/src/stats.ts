/**
 * Ekran ustu sayaclar.
 *
 * Kare ve tick olaylari disaridan bildirilir, zaman disaridan verilir. Boylece
 * sinif saat okumaz ve tarayici olmadan, sahte zamanla tam olarak test edilir.
 */
import type { ReadonlySimState } from '@bfme/core-sim';
import type { Content } from '@bfme/schema';

/** Gosterilecek sayaclar. */
export interface StatsSample {
  /** Saniyedeki kare sayisi. */
  readonly fps: number;
  /** Saniyedeki tick sayisi. Saglikli dongude TICK_RATE'e yakin olmali. */
  readonly ticksPerSecond: number;
  /** Simdiye kadar islenmis tick sayisi. */
  readonly tick: number;
  /** Yasayan varlik sayisi. */
  readonly entityCount: number;
  /** İcerik hash'inin ilk sekiz hanesi. */
  readonly dataHash: string;
}

/** Oranlarin kac milisaniyede bir yeniden hesaplandigi. */
export const DEFAULT_SAMPLE_WINDOW_MS = 500;

export class StatsTracker {
  private frames = 0;
  private ticks = 0;
  private windowStart: number | undefined;
  private fps = 0;
  private ticksPerSecond = 0;

  constructor(private readonly windowMs: number = DEFAULT_SAMPLE_WINDOW_MS) {
    if (!(windowMs > 0)) {
      throw new RangeError(`StatsTracker: pencere pozitif olmali, alinan ${String(windowMs)}`);
    }
  }

  /** Bir kare cizildi. */
  recordFrame(nowMs: number): void {
    // Pencereyi ACAN kare sayilmaz: o bir cit kazigidir, aralik degil.
    // N kare arasinda N-1 aralik vardir; kazigi saymak ilk pencerede orani
    // bir fazla gosterirdi.
    if (this.windowStart === undefined) {
      this.windowStart = nowMs;
      return;
    }
    this.frames = this.frames + 1;

    const elapsed = nowMs - this.windowStart;
    if (elapsed < this.windowMs) return;

    this.fps = (this.frames * 1000) / elapsed;
    this.ticksPerSecond = (this.ticks * 1000) / elapsed;
    this.frames = 0;
    this.ticks = 0;
    this.windowStart = nowMs;
  }

  /** Bir tick islendi. */
  recordTick(): void {
    this.ticks = this.ticks + 1;
  }

  /** Sayilari sifirlar. Sim yeniden baslatildiginda cagrilir. */
  reset(): void {
    this.frames = 0;
    this.ticks = 0;
    this.windowStart = undefined;
    this.fps = 0;
    this.ticksPerSecond = 0;
  }

  /** O anki sayac degerleri. */
  sample(state: ReadonlySimState, content: Content): StatsSample {
    return {
      fps: this.fps,
      ticksPerSecond: this.ticksPerSecond,
      tick: state.tick,
      entityCount: state.entityCount,
      dataHash: formatDataHash(content.dataHash),
    };
  }
}

/** İcerik hash'ini sekiz haneli onaltilik metne cevirir. */
export function formatDataHash(hash: number): string {
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Sayaclari bindirmede gosterilecek satirlara cevirir. */
export function formatStats(sample: StatsSample): string[] {
  return [
    `fps      ${sample.fps.toFixed(1)}`,
    `tick/s   ${sample.ticksPerSecond.toFixed(1)}`,
    `tick     ${String(sample.tick)}`,
    `varlik   ${String(sample.entityCount)}`,
    `icerik   ${sample.dataHash}`,
  ];
}
