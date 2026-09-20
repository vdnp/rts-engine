/**
 * PCG32 (XSH-RR 64/32) deterministik rastgele sayi ureteci.
 *
 * 64 bitlik durum, iki uint32 yarim (hi/lo) ile emule edilir. Tum ara islemler
 * tam sayidir ve double'in 53 bitlik mantisini asmaz, dolayisiyla sonuclar
 * platformdan bagimsizdir.
 *
 * Durum serilestirilebilir: `save()` / `Rng.restore()` ile tick sinirinda
 * kaydedilip geri yuklenebilir.
 *
 * Referans: M.E. O'Neill, "PCG: A Family of Simple Fast Space-Efficient
 * Statistically Good Algorithms for Random Number Generation" (2014).
 */
import { type Fx, imul32 } from './fixed';

/** Carpan 6364136223846793005 = 0x5851F42D4C957F2D. */
const MUL_HI = 0x5851f42d;
const MUL_LO = 0x4c957f2d;

const TWO_POW_32 = 4294967296;

/** Serilestirilebilir ureteci durumu. Dort uint32. */
export interface RngState {
  readonly stateHi: number;
  readonly stateLo: number;
  readonly incHi: number;
  readonly incLo: number;
}

export class Rng {
  private stateHi: number;
  private stateLo: number;
  private readonly incHi: number;
  private readonly incLo: number;

  private constructor(stateHi: number, stateLo: number, incHi: number, incLo: number) {
    this.stateHi = stateHi >>> 0;
    this.stateLo = stateLo >>> 0;
    this.incHi = incHi >>> 0;
    this.incLo = incLo >>> 0;
  }

  /**
   * Seed'den ureteci olusturur.
   *
   * @param seed Baslangic durumu (uint32 olarak yorumlanir).
   * @param sequence Akis secici. Farkli sequence degerleri ayni seed ile
   *   birbirinden bagimsiz diziler uretir.
   */
  static create(seed: number, sequence = 0): Rng {
    const seq = sequence >>> 0;
    const rng = new Rng(0, 0, seq >>> 31, ((seq << 1) | 1) >>> 0);
    rng.next();
    const sumLo = rng.stateLo + (seed >>> 0);
    rng.stateLo = sumLo >>> 0;
    rng.stateHi = (rng.stateHi + (sumLo >= TWO_POW_32 ? 1 : 0)) >>> 0;
    rng.next();
    return rng;
  }

  /** Kaydedilmis durumdan geri yukler. */
  static restore(state: RngState): Rng {
    return new Rng(state.stateHi, state.stateLo, state.incHi, state.incLo);
  }

  /** Mevcut durumun kopyasi. */
  save(): RngState {
    return {
      stateHi: this.stateHi,
      stateLo: this.stateLo,
      incHi: this.incHi,
      incLo: this.incLo,
    };
  }

  /** Sonraki uint32 (0 .. 4294967295). */
  next(): number {
    const oldHi = this.stateHi;
    const oldLo = this.stateLo;

    // state = old * MUL + inc  (64 bit, alt 64 bit korunur)
    const a0 = oldLo & 0xffff;
    const a1 = oldLo >>> 16;
    const b0 = MUL_LO & 0xffff;
    const b1 = MUL_LO >>> 16;
    const p00 = a0 * b0;
    const p01 = a0 * b1;
    const p10 = a1 * b0;
    const p11 = a1 * b1;
    const mid = (p00 >>> 16) + (p01 & 0xffff) + (p10 & 0xffff);
    const prodLo = (((mid & 0xffff) << 16) | (p00 & 0xffff)) >>> 0;
    const carry = (mid >>> 16) + (p01 >>> 16) + (p10 >>> 16) + p11;
    const prodHi = (carry + imul32(oldHi, MUL_LO) + imul32(oldLo, MUL_HI)) >>> 0;

    const sumLo = prodLo + this.incLo;
    this.stateLo = sumLo >>> 0;
    this.stateHi = (prodHi + this.incHi + (sumLo >= TWO_POW_32 ? 1 : 0)) >>> 0;

    // cikti eski durumdan uretilir: xorshifted = (uint32)(((old >> 18) ^ old) >> 27)
    const sh18Hi = oldHi >>> 18;
    const sh18Lo = ((oldLo >>> 18) | (oldHi << 14)) >>> 0;
    const xHi = (sh18Hi ^ oldHi) >>> 0;
    const xLo = (sh18Lo ^ oldLo) >>> 0;
    const xorshifted = ((xLo >>> 27) | (xHi << 5)) >>> 0;

    const rot = oldHi >>> 27;
    return ((xorshifted >>> rot) | (xorshifted << ((32 - rot) & 31))) >>> 0;
  }

  /**
   * [0, max) araliginda tarafsiz tam sayi. Reddetme ornekleme kullanir, yani
   * cagri basina tuketilen sayi degisebilir — ama ayni seed ayni diziyi verir.
   *
   * @throws {RangeError} max pozitif bir tam sayi degilse.
   */
  nextInt(max: number): number {
    if (!Number.isInteger(max) || max <= 0 || max > TWO_POW_32) {
      throw new RangeError(`Rng.nextInt: max 1..2^32 araliginda tam sayi olmali, alinan ${max}`);
    }
    const threshold = (TWO_POW_32 - max) % max;
    for (;;) {
      const r = this.next();
      if (r >= threshold) return r % max;
    }
  }

  /** [0, 1) araliginda Q16.16 deger. 65536 farkli sonuc uretir. */
  nextFx(): Fx {
    return (this.next() >>> 16) as Fx;
  }

  /**
   * [min, max] araliginda (iki uc dahil) tam sayi.
   *
   * @throws {RangeError} min > max ise.
   */
  nextIntRange(min: number, max: number): number {
    if (min > max) {
      throw new RangeError(`Rng.nextIntRange: min (${min}) > max (${max})`);
    }
    return min + this.nextInt(max - min + 1);
  }

  /** `true` olma olasiligi 1/n. */
  chance(n: number): boolean {
    return this.nextInt(n) === 0;
  }
}
