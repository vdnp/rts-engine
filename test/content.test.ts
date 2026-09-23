/**
 * Depoya konan vanilla icerigin gercekten yuklendigini dogrular.
 *
 * Birim testleri uydurma fixture'larla calisir; bu test `content/base/`
 * altindaki GERCEK dosyalari okur. Bir sayiyi bozan degisiklik burada yakalanir.
 *
 * Node dosya sistemi yalnizca burada kullanilir: `packages/**` icinde `node:*`
 * yasaktir, yukleyiciye dosyalar bir `ContentSource` uzerinden verilir.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ContentSource, formatIssues, loadContent } from '@bfme/modloader';
import { Fx } from '@bfme/sim-math';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(repoRoot, 'content');

/** Bir dizini gezip icerik kokune gore `/` ayrac ile yollari toplar. */
function walk(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    const relative = prefix === '' ? entry : `${prefix}/${entry}`;
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, relative));
    } else {
      out.push(relative);
    }
  }
  return out;
}

function diskSource(root: string): ContentSource {
  const files = walk(root);
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

function loadBase() {
  const result = loadContent(diskSource(contentDir), { enabled: ['base'] });
  if (!result.ok) {
    throw new Error(`content/base yuklenemedi:\n${formatIssues(result.issues)}`);
  }
  return result.content;
}

describe('content/base', () => {
  it('hatasiz yuklenir', () => {
    const result = loadContent(diskSource(contentDir), { enabled: ['base'] });
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it('iki fraksiyon ve dort birim tanimlar', () => {
    const content = loadBase();
    expect(content.factions).toHaveLength(2);
    expect(content.unitTypes).toHaveLength(4);
    expect(content.mods.map((mod) => mod.id)).toEqual(['base']);
  });

  it('her birim tam olarak bir kadroda gecer', () => {
    const content = loadBase();
    const listed = content.factions.flatMap((faction) => [...faction.unitTypes]);
    expect(listed).toHaveLength(content.unitTypes.length);
    expect(new Set(listed).size).toBe(content.unitTypes.length);
  });

  it('sayilari makul araliklarda tutar', () => {
    const content = loadBase();
    for (const type of content.unitTypes) {
      expect(type.maxHealth).toBeGreaterThan(0);
      expect(Fx.toFloat(type.speed)).toBeGreaterThan(0);
      expect(Fx.toFloat(type.speed)).toBeLessThan(50);
      expect(Fx.toFloat(type.radius)).toBeGreaterThan(0);
      expect(Fx.toFloat(type.radius)).toBeLessThan(5);
      expect(type.turnRate).toBeGreaterThan(0);
    }
  });

  it('fraksiyon renkleri gecerli', () => {
    const content = loadBase();
    for (const faction of content.factions) {
      expect(faction.color).toHaveLength(3);
      for (const channel of faction.color) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });

  it('asset referansi icermez', () => {
    // Faz 0'da hicbir icerik dosyasi dis varlik gostermez; asset'ler Faz 1'de
    // oyuncunun kendi kurulumundan, calisma aninda okunacak.
    for (const relative of walk(contentDir)) {
      expect(relative.endsWith('.toml')).toBe(true);
      const text = readFileSync(path.join(contentDir, relative), 'utf8');
      expect(text).not.toMatch(/\.(w3d|dds|tga|wav|mp3|png|jpg|big)\b/i);
    }
  });

  it('ayni icerik ayni dataHash verir', () => {
    expect(loadBase().dataHash).toBe(loadBase().dataHash);
  });
});
