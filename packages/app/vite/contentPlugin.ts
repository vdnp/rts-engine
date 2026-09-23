/**
 * İcerik dosyalarini sanal bir modul olarak sunan Vite eklentisi.
 *
 * Tarayici dosya sistemine dokunamaz; bu yuzden `content/` altindaki TOML
 * dosyalari DERLEME aninda okunup `virtual:bfme-content` moduluna gomulur.
 * Gelistirmede dosyalar izlenir ve degisiklik ozel bir HMR olayiyla
 * uygulamaya bildirilir.
 *
 * Node API'leri YALNIZCA burada kullanilir: bu dosya tarayiciya hic gitmez,
 * Vite'in kendi surecinde calisir.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Plugin, loadEnv } from 'vite';

const VIRTUAL_ID = 'virtual:bfme-content';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/** Uygulamaya icerik degisikligini bildiren HMR olayi. */
export const CONTENT_EVENT = 'bfme:content';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Dizini gezip icerik kokune gore `/` ayracli yollari toplar. */
function walk(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    const relative = prefix === '' ? entry : `${prefix}/${entry}`;
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, relative));
    } else if (entry.endsWith('.toml')) {
      out.push(relative);
    }
  }
  return out;
}

function readContent(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const relative of walk(root)) {
    files[relative] = readFileSync(path.join(root, relative), 'utf8');
  }
  return files;
}

export function contentPlugin(): Plugin {
  let contentRoot = path.join(repoRoot, 'content');

  return {
    name: 'bfme:content',

    config(_userConfig, env) {
      // `BFME_CONTENT_DIR` VITE_ onekli DEGİLDİR: tarayiciya sizmamali.
      // Vite'in loadEnv'i ile .env dosyalarindan ve ortamdan okunur.
      const loaded = loadEnv(env.mode, repoRoot, 'BFME_');
      const configured = loaded['BFME_CONTENT_DIR'];
      contentRoot =
        configured === undefined || configured.trim() === ''
          ? path.join(repoRoot, 'content')
          : path.resolve(repoRoot, configured.trim());
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },

    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      return `export const files = ${JSON.stringify(readContent(contentRoot))};`;
    },

    configureServer(server) {
      server.watcher.add(contentRoot);

      const notify = (changed: string): void => {
        if (!path.resolve(changed).startsWith(contentRoot)) return;
        if (!changed.endsWith('.toml')) return;
        server.config.logger.info(
          `[bfme:content] ${path.relative(contentRoot, changed)} degisti, yeniden yukleniyor`,
        );
        server.hot.send({
          type: 'custom',
          event: CONTENT_EVENT,
          data: { files: readContent(contentRoot) },
        });
      };

      server.watcher.on('add', notify);
      server.watcher.on('change', notify);
      server.watcher.on('unlink', notify);
    },
  };
}
