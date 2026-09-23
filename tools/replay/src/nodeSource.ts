/**
 * Dosya sisteminden okuyan `ContentSource`.
 *
 * `packages/**` icinde `node:*` yasaktir: yukleyici dosya sistemine dokunmaz,
 * dosyalar ona bu arayuz uzerinden verilir. Node tarafindaki uygulama budur;
 * tarayici tarafindakini Vite eklentisi saglar.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { ContentSource } from '@bfme/modloader';

/** Dizini gezip icerik kokune gore `/` ayracli yollari toplar. */
export function walkContent(root: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root).sort()) {
    const full = path.join(root, entry);
    const relative = prefix === '' ? entry : `${prefix}/${entry}`;
    if (statSync(full).isDirectory()) {
      out.push(...walkContent(full, relative));
    } else if (entry.endsWith('.toml')) {
      out.push(relative);
    }
  }
  return out;
}

/**
 * Verilen kokten okuyan kaynak.
 *
 * Dosya listesi bir kez, kurulusta alinir; calisma sirasinda dizin degisse
 * bile ayni koşu ayni dosyalari gorur.
 */
export function nodeSource(root: string): ContentSource {
  const files = walkContent(root);
  return {
    list: () => files,
    read: (relative) => {
      try {
        return readFileSync(path.join(root, relative), 'utf8');
      } catch {
        return undefined;
      }
    },
  };
}
