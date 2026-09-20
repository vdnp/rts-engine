/**
 * Baglanmis (linked) icerik. Yukleme boru hattinin son urunu.
 *
 * Bu asamada metin referanslari sayisal kimliklere cozulmustur ve sayilar
 * fixed-point'e cevrilmistir. Nesne derin dondurulmustur; calisma aninda
 * hicbir sistem icerigi degistiremez.
 *
 * DİKKAT: `core-sim` bu nesnenin Map'lerini ASLA iterate etmez — iterasyon
 * sirasi determinizm riskidir. Sirali erisim her zaman dizi indeksi uzerinden
 * yapilir; dizi indeksi sayisal kimligin ta kendisidir.
 */
import type { Fx } from '@bfme/sim-math';
import type { Color } from './primitives';

/** Birim tipinin sayisal kimligi. `Content.unitTypes` dizisindeki indekstir. */
export type UnitTypeId = number & { readonly __unitTypeId: true };

/** Fraksiyonun sayisal kimligi. `Content.factions` dizisindeki indekstir. */
export type FactionId = number & { readonly __factionId: true };

/** Acisal hiz: BAM birimi / saniye. `Angle` ile karistirilamaz. */
export type AngularRate = number & { readonly __angularRate: true };

/** Baglanmis birim tipi. */
export interface UnitType {
  readonly id: UnitTypeId;
  /** İcerik dosyasindaki metin anahtari. Hata mesajlari ve arac icindir. */
  readonly key: string;
  readonly name: string;
  readonly faction: FactionId;
  /** Azami saglik, tam sayi. */
  readonly maxHealth: number;
  /** Hiz, dunya birimi / saniye. Tick'e donusumu sim yapar. */
  readonly speed: Fx;
  /** Donus hizi, BAM birimi / saniye. */
  readonly turnRate: AngularRate;
  /** Carpisma yaricapi, dunya birimi. */
  readonly radius: Fx;
}

/** Baglanmis fraksiyon. */
export interface Faction {
  readonly id: FactionId;
  readonly key: string;
  readonly name: string;
  readonly color: Color;
  /** Bu fraksiyona ait birim tiplerinin sayisal kimlikleri, tanim sirasinda. */
  readonly unitTypes: readonly UnitTypeId[];
}

/** Yuklenmis bir icerik paketinin ozeti. */
export interface ModInfo {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  /** Yukleme sirasi; 0 ilk yuklenen. */
  readonly order: number;
}

/** Derin dondurulmus, baglanmis icerik. */
export interface Content {
  /** İcerigin FNV-1a hash'i. Determinizm dogrulamasinin capasi. */
  readonly dataHash: number;
  /** Yukleme sirasinda mod'lar. */
  readonly mods: readonly ModInfo[];
  /** Birim tipleri; indeks === `UnitTypeId`. */
  readonly unitTypes: readonly UnitType[];
  /** Fraksiyonlar; indeks === `FactionId`. */
  readonly factions: readonly Faction[];
  /** Metin anahtarindan sayisal kimlige. Sadece arac ve tani icin, iterate edilmez. */
  readonly unitTypeByKey: ReadonlyMap<string, UnitTypeId>;
  /** Metin anahtarindan sayisal kimlige. Sadece arac ve tani icin, iterate edilmez. */
  readonly factionByKey: ReadonlyMap<string, FactionId>;
}
