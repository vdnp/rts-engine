/**
 * Simulasyonun tek giris noktasi.
 *
 * Imza sabittir ve genisletilmez:
 *
 *   tick(state, commands, content): void
 *
 * Baska hicbir seye dokunmaz: saat okumaz, G/C yapmaz, kendi disinda hicbir
 * durumu degistirmez. Sistem cagri SIRASI determinizmin parcasidir; yeni bir
 * sistem eklendiginde sabit bir yere konur ve bu sira degismez.
 */
import type { Content } from '@bfme/schema';
import { type Command, applyCommands } from './commands';
import type { SimState } from './state';
import { healthSystem } from './systems/health';
import { movementSystem } from './systems/movement';

export function tick(state: SimState, commands: readonly Command[], content: Content): void {
  // 1. Disaridan gelen niyet
  applyCommands(state, commands, content);
  // 2. Hareket
  movementSystem(state, content);
  // 3. Yasam dongusu
  healthSystem(state);

  state.tick = (state.tick + 1) | 0;
}
