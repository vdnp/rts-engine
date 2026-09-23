import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { workspaceAlias } from '../../scripts/aliases.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Node 22 TypeScript'i dogrudan calistiramadigi icin arac tek bir ESM
 * dosyasina paketlenir. Paketler kaynak .ts dosyalarindan cozulur.
 */
export default defineConfig({
  root: here,
  resolve: { alias: workspaceAlias },
  build: {
    ssr: path.join(here, 'src', 'cli.ts'),
    outDir: path.join(here, 'dist'),
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rollupOptions: {
      output: { entryFileNames: 'replay.js', format: 'esm' },
    },
  },
});
