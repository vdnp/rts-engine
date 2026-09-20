// Tek kaynaklı workspace alias tablosu. Vite ve Vitest konfigleri bunu kullanır,
// böylece paketler her zaman kaynak .ts dosyasından çözülür (derleme adımı yok).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Diğer paketler tarafından import edilebilen paketler. `app` giriş noktasıdır, import edilmez. */
export const LIBRARY_PACKAGES = [
  'sim-math',
  'schema',
  'modloader',
  'core-sim',
  'engine',
  'core-present',
];

/** @type {Record<string, string>} */
export const workspaceAlias = Object.fromEntries(
  LIBRARY_PACKAGES.map((name) => [
    `@bfme/${name}`,
    path.join(repoRoot, 'packages', name, 'src', 'index.ts'),
  ]),
);
