/**
 * Saglik sistemi.
 *
 * Faz 0'da hicbir sey hasar vermez; bu sistem yasam dongusunun kapanis
 * halkasidir: sagligi ust sinirin uzerine cikmis varliklari kirpar ve sifirin
 * altina dusmus varliklari yok eder. Savas geldiginde hasar kaynaklari yalnizca
 * `health` alanina yazacak, yok etme karari burada kalacak.
 */
import { type SimState, destroySlot, readI32, readU8 } from '../state';

export function healthSystem(state: SimState): void {
  for (let slot = 0; slot < state.highWater; slot++) {
    if (readU8(state.alive, slot) !== 1) continue;

    const maxHealth = readI32(state.maxHealth, slot);
    const health = readI32(state.health, slot);

    if (health <= 0) {
      destroySlot(state, slot);
      continue;
    }
    if (health > maxHealth) {
      state.health[slot] = maxHealth;
    }
  }
}
