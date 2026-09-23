/**
 * Tek kaynakli workspace alias tablosu.
 *
 * Vite ve Vitest konfigleri bunu kullanir, boylece paketler her zaman kaynak
 * .ts dosyasindan cozulur ve arada bir derleme adimi olmaz.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Diger paketler tarafindan import edilebilen paketler. `app` giris noktasidir. */
export const LIBRARY_PACKAGES = [
  'sim-math',
  'schema',
  'modloader',
  'core-sim',
  'engine',
  'core-present',
] as const;

export const workspaceAlias: Record<string, string> = Object.fromEntries(
  LIBRARY_PACKAGES.map((name) => [
    `@bfme/${name}`,
    path.join(repoRoot, 'packages', name, 'src', 'index.ts'),
  ]),
);
