import { describe, expect, it } from 'vitest';
import type { DiscoveredPackage } from '../src/discover';
import { discover } from '../src/discover';
import { buildLineMap } from '../src/linemap';
import { canonicalize, deepFreeze, formatHash } from '../src/freeze';
import { order } from '../src/order';
import { resolve } from '../src/resolve';
import { memorySource } from '../src/source';
import { baseOnlyFiles, fixtureFiles } from './fixture';

/** Kisa manifest metni uretir. */
function manifest(id: string, version: string, deps: Record<string, string> = {}): string {
  const lines = [`id = "${id}"`, `name = "${id}"`, `version = "${version}"`];
  if (Object.keys(deps).length > 0) {
    lines.push('', '[dependencies]');
    for (const [k, v] of Object.entries(deps)) lines.push(`${k} = "${v}"`);
  }
  return `${lines.join('\n')}\n`;
}

describe('memorySource', () => {
  it('yollari sirali verir ve icerik okur', () => {
    const source = memorySource({ 'b/x.toml': 'b', 'a/y.toml': 'a' });
    expect(source.list()).toEqual(['a/y.toml', 'b/x.toml']);
    expect(source.read('a/y.toml')).toBe('a');
    expect(source.read('yok')).toBeUndefined();
  });
});

describe('discover', () => {
  it('manifestleri bulur ve paket dosyalarini toplar', () => {
    const result = discover(memorySource(fixtureFiles()));
    expect(result.issues).toEqual([]);
    expect(result.packages.map((p) => p.dir)).toEqual(['alpha', 'base', 'beta']);
    const base = result.packages.find((p) => p.dir === 'base');
    expect(base?.files).toEqual([
      'base/factions/order.toml',
      'base/units/archer.toml',
      'base/units/spearman.toml',
    ]);
  });

  it('etkin liste verilince sadece onlari alir', () => {
    const result = discover(memorySource(fixtureFiles()), ['base', 'beta']);
    expect(result.packages.map((p) => p.dir)).toEqual(['base', 'beta']);
    expect(result.issues).toEqual([]);
  });

  it('etkin listede olup bulunamayan paketi raporlar', () => {
    const result = discover(memorySource(baseOnlyFiles()), ['base', 'yok']);
    expect(result.packages.map((p) => p.dir)).toEqual(['base']);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.mod).toBe('yok');
    expect(result.issues[0]?.got).toBe('bulunamadi');
  });

  it('kimlik dizin adiyla uyusmazsa reddeder', () => {
    const files = baseOnlyFiles();
    files['base/manifest.toml'] = manifest('baska_ad', '1.0.0');
    const result = discover(memorySource(files));
    expect(result.packages).toEqual([]);
    expect(result.issues[0]?.expected).toContain('"base"');
    expect(result.issues[0]?.line).toBe(1);
  });

  it('bozuk manifesti sema hatasi olarak raporlar', () => {
    const files = baseOnlyFiles();
    files['base/manifest.toml'] = 'id = "base"\nname = "x"\nversion = "1.0"\n';
    const result = discover(memorySource(files));
    expect(result.packages).toEqual([]);
    expect(result.issues[0]?.path).toBe('version');
    expect(result.issues[0]?.line).toBe(3);
  });
});

describe('resolve', () => {
  const packagesFrom = (files: Record<string, string>) => discover(memorySource(files)).packages;

  it('karsilanan bagimliliklari gecirir', () => {
    const result = resolve(packagesFrom(fixtureFiles()));
    expect(result.issues).toEqual([]);
    expect(result.packages).toHaveLength(3);
  });

  it('eksik bagimliligi raporlar ve paketi eler', () => {
    const files = baseOnlyFiles();
    files['solo/manifest.toml'] = manifest('solo', '1.0.0', { yok: '*' });
    const result = resolve(packagesFrom(files));
    expect(result.packages.map((p) => p.dir)).toEqual(['base']);
    expect(result.issues[0]?.path).toBe('dependencies.yok');
    expect(result.issues[0]?.got).toBe('paket yuklu degil');
  });

  it('surum araligi karsilanmayinca raporlar', () => {
    const files = baseOnlyFiles();
    files['solo/manifest.toml'] = manifest('solo', '1.0.0', { base: '^2.0.0' });
    const result = resolve(packagesFrom(files));
    expect(result.issues[0]?.expected).toBe('"base" surumu ^2.0.0');
    expect(result.issues[0]?.got).toBe('surum 1.0.0');
    // 6. satir: [dependencies] altindaki `base = "^2.0.0"` girisi
    expect(result.issues[0]?.line).toBe(6);
  });

  it('ayni kimligi tasiyan iki paketi cakisma sayar', () => {
    // discover kimlik = dizin adi kuralini zorladigi icin bu durum boru hattinda
    // olusamaz; `resolve` yine de dogrudan cagrilabilen bir asama oldugundan
    // kendi girdisini denetler.
    const make = (dir: string, id: string): DiscoveredPackage => ({
      dir,
      manifest: { id, name: id, version: '1.0.0', dependencies: {} },
      lines: buildLineMap(`id = "${id}"\n`),
      files: [],
    });
    const result = resolve([make('first', 'ayni'), make('second', 'ayni')]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.expected).toBe('benzersiz paket kimligi');
    expect(result.issues[0]?.got).toContain('"first" tarafindan kullaniliyor');
    expect(result.packages.map((p) => p.dir)).toEqual(['first']);
  });

  it('kendine bagimliligi raporlar', () => {
    const files = baseOnlyFiles();
    files['solo/manifest.toml'] = manifest('solo', '1.0.0', { solo: '*' });
    const result = resolve(packagesFrom(files));
    expect(result.issues[0]?.got).toBe('paketin kendisi');
  });
});

describe('order', () => {
  const packagesFrom = (files: Record<string, string>) =>
    resolve(discover(memorySource(files)).packages).packages;

  it('bagimliligi once yukler', () => {
    const files = {
      'a/manifest.toml': manifest('a', '1.0.0', { c: '*' }),
      'b/manifest.toml': manifest('b', '1.0.0', { a: '*' }),
      'c/manifest.toml': manifest('c', '1.0.0'),
    };
    const result = order(packagesFrom(files));
    expect(result.issues).toEqual([]);
    expect(result.packages.map((p) => p.dir)).toEqual(['c', 'a', 'b']);
  });

  it('bagimsiz paketlerde tercih sirasini uygular', () => {
    const files = {
      'a/manifest.toml': manifest('a', '1.0.0'),
      'b/manifest.toml': manifest('b', '1.0.0'),
      'c/manifest.toml': manifest('c', '1.0.0'),
    };
    expect(order(packagesFrom(files), ['c', 'b', 'a']).packages.map((p) => p.dir)).toEqual([
      'c',
      'b',
      'a',
    ]);
    // tercih yoksa alfabetik
    expect(order(packagesFrom(files)).packages.map((p) => p.dir)).toEqual(['a', 'b', 'c']);
  });

  it('tercih sirasi bagimliligi ezemez', () => {
    const files = {
      'a/manifest.toml': manifest('a', '1.0.0', { b: '*' }),
      'b/manifest.toml': manifest('b', '1.0.0'),
    };
    const result = order(packagesFrom(files), ['a', 'b']);
    expect(result.packages.map((p) => p.dir)).toEqual(['b', 'a']);
  });

  it('donguyu anlamli bir hatayla raporlar', () => {
    const files = {
      'a/manifest.toml': manifest('a', '1.0.0', { b: '*' }),
      'b/manifest.toml': manifest('b', '1.0.0', { c: '*' }),
      'c/manifest.toml': manifest('c', '1.0.0', { a: '*' }),
    };
    const result = order(packagesFrom(files));
    expect(result.packages).toEqual([]);
    expect(result.issues).toHaveLength(3);
    expect(result.issues[0]?.got).toBe('dongu: a -> b -> c -> a');
    expect(result.issues[0]?.expected).toBe('dongusuz bagimlilik grafigi');
  });

  it('dongu disindaki paketleri yine de siralar', () => {
    const files = {
      'a/manifest.toml': manifest('a', '1.0.0', { b: '*' }),
      'b/manifest.toml': manifest('b', '1.0.0', { a: '*' }),
      'z/manifest.toml': manifest('z', '1.0.0'),
    };
    const result = order(packagesFrom(files));
    expect(result.packages.map((p) => p.dir)).toEqual(['z']);
    expect(result.issues).toHaveLength(2);
  });
});

describe('freeze yardimcilari', () => {
  it('deepFreeze ic ice yapilari dondurur', () => {
    const value = deepFreeze({ a: { b: [1, { c: 2 }] } });
    expect(Object.isFrozen(value.a)).toBe(true);
    expect(Object.isFrozen(value.a.b)).toBe(true);
    expect(Object.isFrozen(value.a.b[1])).toBe(true);
  });

  it('deepFreeze donguleri kirar', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(() => deepFreeze(cyclic)).not.toThrow();
    expect(Object.isFrozen(cyclic)).toBe(true);
  });

  it('deepFreeze ilkel degerlere dokunmaz', () => {
    expect(deepFreeze(5)).toBe(5);
    expect(deepFreeze(null)).toBeNull();
  });

  it('canonicalize sirali ve tam metin uretir', () => {
    const text = canonicalize([{ id: 'base', name: 'Temel', version: '1.0.0', order: 0 }], [], []);
    expect(text).toBe('mod|0|base|1.0.0|Temel');
  });

  it('formatHash sekiz haneli onaltilik verir', () => {
    expect(formatHash(0)).toBe('00000000');
    expect(formatHash(0xdeadbeef)).toBe('deadbeef');
    expect(formatHash(-1)).toBe('ffffffff');
  });
});
