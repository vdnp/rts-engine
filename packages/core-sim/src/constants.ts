/**
 * Simulasyon sabitleri.
 *
 * Burada duvar saati birimi YOKTUR. Sim yalnizca tick sayar; milisaniye,
 * kare suresi ve interpolasyon present katmaninin isidir.
 */

/** Saniyedeki tick sayisi. Sabittir; degistirmek determinizmi bozar. */
export const TICK_RATE = 30;

/** Varsayilan baslangic kapasitesi (slot sayisi). Gerektiginde ikiye katlanir. */
export const DEFAULT_CAPACITY = 1024;
