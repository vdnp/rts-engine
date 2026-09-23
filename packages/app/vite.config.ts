import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { workspaceAlias } from '../../scripts/aliases.ts';
import { contentPlugin } from './vite/contentPlugin';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  // Paketler kaynak .ts dosyalarindan cozulur; on-paketleme yok, boylece
  // tek bir derleme adimi olmadan dogrudan calisir.
  resolve: { alias: workspaceAlias },
  plugins: [contentPlugin()],
  build: {
    outDir: path.join(here, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    port: 5173,
  },
});
