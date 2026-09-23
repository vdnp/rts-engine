/**
 * Sabit adimli zaman dongusu.
 *
 * Sim her zaman ayni buyuklukte adimlarla ilerler; ekran hizi degisse bile
 * simulasyon ayni sonucu verir. Kareler arasi fark `alpha` olarak birikir ve
 * interpolasyona devredilir.
 *
 * Duvar saati okumaz: gecen sure disaridan verilir, bu yuzden tarayici
 * olmadan tam olarak test edilir.
 */

/** Bir karede islenebilecek en fazla tick. Olum sarmalini engeller. */
export const DEFAULT_MAX_TICKS_PER_FRAME = 5;

export class FixedTimestep {
  private accumulatorMs = 0;

  /**
   * @param tickMs Bir tick'in suresi, milisaniye.
   * @param maxTicksPerFrame Bir karede en fazla kac tick islenecegi. Sekme
   *   arka plandan donunce biriken saatler yuzunden oyun kilitlenmesin diye
   *   fazlasi ATILIR: sim yavaslar ama durmaz.
   */
  constructor(
    private readonly tickMs: number,
    private readonly maxTicksPerFrame: number = DEFAULT_MAX_TICKS_PER_FRAME,
  ) {
    if (!(tickMs > 0)) {
      throw new RangeError(`FixedTimestep: tick suresi pozitif olmali, alinan ${String(tickMs)}`);
    }
    if (!Number.isInteger(maxTicksPerFrame) || maxTicksPerFrame < 1) {
      throw new RangeError(
        `FixedTimestep: kare basina tick siniri en az 1 olmali, alinan ${String(maxTicksPerFrame)}`,
      );
    }
  }

  /** Son tick'ten bu yana birikmis sure. Her zaman bir tick'ten kisadir. */
  get accumulator(): number {
    return this.accumulatorMs;
  }

  /** Interpolasyon carpani, [0, 1). */
  get alpha(): number {
    return this.accumulatorMs / this.tickMs;
  }

  /**
   * Gecen sureyi isler ve gereken sayida tick calistirir.
   *
   * @param deltaMs Onceki kareden bu yana gecen sure. Negatif ya da bozuk
   *   degerler sifir sayilir.
   * @returns Bu karede islenen tick sayisi.
   */
  advance(deltaMs: number, step: () => void): number {
    this.accumulatorMs = this.accumulatorMs + (!(deltaMs > 0) ? 0 : deltaMs);

    // Tick sayisi TEK bir bolmeyle bulunur. Dongude tekrar tekrar cikarmak
    // kayan nokta hatasi biriktirir: tam olarak 3 tick'lik bir sure, ucuncu
    // karsilastirmada bir mikro-birim eksik kalip 2 tick atabiliyordu.
    const available = Math.floor(this.accumulatorMs / this.tickMs);
    const ticks = available > this.maxTicksPerFrame ? this.maxTicksPerFrame : available;

    for (let i = 0; i < ticks; i++) step();
    this.accumulatorMs = this.accumulatorMs - ticks * this.tickMs;

    // Sinira dayanildiysa biriken fazla ATILIR: sim yavaslar ama kilitlenmez.
    // Birikim her zaman bir tick'ten kisadir, yani alpha [0, 1) araligindadir.
    if (this.accumulatorMs >= this.tickMs) {
      this.accumulatorMs = this.accumulatorMs % this.tickMs;
    } else if (this.accumulatorMs < 0) {
      this.accumulatorMs = 0;
    }
    return ticks;
  }

  /** Birikeni sifirlar. Sim yeniden baslatildiginda cagrilir. */
  reset(): void {
    this.accumulatorMs = 0;
  }
}
