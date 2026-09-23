/**
 * İki slotluk donusum halka tamponu.
 *
 * Interpolasyon tick N-1 ve N gerektirir, ama SİM TEK DURUM TUTAR: gecmisi
 * saklamak simulasyonun isi degildir. Kopyalama burada, tick sinirinda
 * `Int32Array.set` ile yapilir — tek bir toplu bellek kopyasi.
 *
 * Halkada yalnizca gorsellestirmeye giren alanlar tutulur. Hiz, saglik ve
 * hedef gibi alanlar cizime girmedikleri icin kopyalanmaz.
 */
import type { ReadonlySimState } from '@bfme/core-sim';

/** Halkada tutulan tam sayi alanlari. */
const I32_FIELDS = ['generation', 'posX', 'posY', 'facing', 'owner', 'unitType'] as const;

type I32Field = (typeof I32_FIELDS)[number];

/** Tek bir tick'in gorsel anlik goruntusu. */
export type Snapshot = {
  /** Bu anlik goruntudeki kullanilmis en yuksek slot + 1. */
  highWater: number;
  /** Sim'in tick sayaci. */
  tick: number;
  alive: Uint8Array;
} & { [K in I32Field]: Int32Array };

function createSnapshot(capacity: number): Snapshot {
  const snapshot = {
    highWater: 0,
    tick: 0,
    alive: new Uint8Array(capacity),
  } as Snapshot;
  for (const field of I32_FIELDS) snapshot[field] = new Int32Array(capacity);
  return snapshot;
}

function growSnapshot(snapshot: Snapshot, capacity: number): void {
  const alive = new Uint8Array(capacity);
  alive.set(snapshot.alive);
  snapshot.alive = alive;
  for (const field of I32_FIELDS) {
    const next = new Int32Array(capacity);
    next.set(snapshot[field]);
    snapshot[field] = next;
  }
}

/**
 * Son iki tick'in gorsel durumunu tutar.
 *
 * `capture` her tick'ten SONRA, tam olarak bir kez cagrilir. Kare cizimi
 * arasinda cagrilmaz; aksi halde interpolasyonun iki ucu ayni tick'i gosterir.
 */
export class TransformRing {
  private capacity: number;
  private readonly slots: [Snapshot, Snapshot];
  /** En yeni anlik goruntunun slot numarasi. Tip dar: indeks her zaman gecerli. */
  private newest: 0 | 1 = 0;
  /** Simdiye kadar alinmis anlik goruntu sayisi (en fazla 2 olarak sayilir). */
  private captured = 0;

  constructor(capacity = 1024) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(
        `TransformRing: kapasite pozitif tam sayi olmali, alinan ${String(capacity)}`,
      );
    }
    this.capacity = capacity;
    this.slots = [createSnapshot(capacity), createSnapshot(capacity)];
  }

  /** Kac anlik goruntu alindigi; 2'den sonra sabit kalir. */
  get snapshotCount(): number {
    return this.captured;
  }

  /** En yeni anlik goruntu. Hic yoksa bos bir goruntudur. */
  get current(): Snapshot {
    return this.slots[this.newest];
  }

  /**
   * Bir onceki anlik goruntu.
   *
   * Yalnizca tek bir goruntu alinmissa en yeniyi dondurur; boylece ilk karede
   * interpolasyon kendi uzerine yapilir ve varliklar sifir noktasindan
   * kaymak yerine dogdugu yerde durur.
   */
  get previous(): Snapshot {
    if (this.captured < 2) return this.current;
    return this.slots[this.newest === 0 ? 1 : 0];
  }

  /** Sim durumunun gorsel alanlarini yeni slota kopyalar. */
  capture(state: ReadonlySimState): void {
    this.ensureCapacity(state.capacity);

    this.newest = this.newest === 0 ? 1 : 0;
    const target = this.slots[this.newest];

    target.highWater = state.highWater;
    target.tick = state.tick;
    // Tek toplu kopya; alan basina dongu yok.
    target.alive.set(state.alive);
    for (const field of I32_FIELDS) {
      target[field].set(state[field]);
    }

    if (this.captured < 2) this.captured = this.captured + 1;
  }

  /** Halkayi bosaltir. Sim yeniden baslatildiginda cagrilir. */
  reset(): void {
    this.captured = 0;
    this.newest = 0;
    for (const snapshot of this.slots) {
      snapshot.highWater = 0;
      snapshot.tick = 0;
      snapshot.alive.fill(0);
      for (const field of I32_FIELDS) snapshot[field].fill(0);
    }
  }

  private ensureCapacity(needed: number): void {
    if (needed <= this.capacity) return;
    let capacity = this.capacity;
    while (capacity < needed) capacity = capacity * 2;
    // Her iki slot da buyur: onceki anlik goruntu kaybolmamali.
    for (const snapshot of this.slots) growSnapshot(snapshot, capacity);
    this.capacity = capacity;
  }
}

/**
 * Bir slottaki varligin iki anlik goruntu arasinda AYNI varlik olup
 * olmadigini soyler.
 *
 * Slot geri donusturulmus olabilir: ayni slot numarasi onceki tick'te baska
 * bir varliga aitse konumlari karistirmak ekranda isinlanma yaratir. Nesil
 * etiketi bunu yakalar.
 */
export function isContinuous(previous: Snapshot, current: Snapshot, slot: number): boolean {
  if (slot >= previous.highWater) return false;
  if (previous.alive[slot] !== 1) return false;
  return previous.generation[slot] === current.generation[slot];
}
