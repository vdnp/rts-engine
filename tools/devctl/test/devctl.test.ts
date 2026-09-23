import { memorySource } from '@bfme/modloader';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { nodeSource } from '../../replay/src/nodeSource.ts';
import { inspectContent, inspectMods } from '../src/inspect';
import { formatMods, formatValidate, table } from '../src/report';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const contentDir = path.join(repoRoot, 'content');

/** Kucuk, elle kurulmus bir icerik kumesi. */
function manifest(id: string, version: string, deps: Record<string, string> = {}): string {
  const lines = [`id = "${id}"`, `name = "${id}"`, `version = "${version}"`];
  if (Object.keys(deps).length > 0) {
    lines.push('', '[dependencies]');
    for (const [key, range] of Object.entries(deps)) lines.push(`${key} = "${range}"`);
  }
  return `${lines.join('\n')}\n`;
}

const UNIT = [
  '[unit.walker]',
  'name = "Yuruyen"',
  'maxHealth = 100',
  'speed = 6.0',
  'turnRate = 360.0',
  'radius = 0.5',
  '',
].join('\n');

const FACTION = [
  '[faction.alpha]',
  'name = "Alfa"',
  'color = [10, 20, 30]',
  'units = ["walker"]',
  '',
].join('\n');

function tinySource(extra: Record<string, string> = {}) {
  return memorySource({
    'base/manifest.toml': manifest('base', '1.0.0'),
    'base/u.toml': UNIT,
    'base/f.toml': FACTION,
    ...extra,
  });
}

describe('inspectMods', () => {
  it('paketleri kimlige gore siralar', () => {
    const source = tinySource({
      'zeta/manifest.toml': manifest('zeta', '1.0.0'),
      'alpha/manifest.toml': manifest('alpha', '1.0.0'),
    });
    expect(inspectMods(source).packages.map((pkg) => pkg.id)).toEqual(['alpha', 'base', 'zeta']);
  });

  it('surum, dosya sayisi ve bagimliliklari bildirir', () => {
    const source = tinySource({
      'ek/manifest.toml': manifest('ek', '0.2.0', { base: '^1.0.0' }),
      'ek/x.toml': '[patch.unit.walker]\nspeed = 9.0\n',
    });
    const report = inspectMods(source);
    const ek = report.packages.find((pkg) => pkg.id === 'ek');
    expect(ek?.version).toBe('0.2.0');
    expect(ek?.fileCount).toBe(1);
    expect(ek?.dependencies).toEqual([{ id: 'base', range: '^1.0.0' }]);
    expect(ek?.ok).toBe(true);
  });

  it('bagimliliga gore yukleme sirasini cozer', () => {
    const source = tinySource({
      'ek/manifest.toml': manifest('ek', '1.0.0', { base: '*' }),
    });
    expect(inspectMods(source).loadOrder).toEqual(['base', 'ek']);
  });

  it('tercih sirasini uygular', () => {
    const source = memorySource({
      'a/manifest.toml': manifest('a', '1.0.0'),
      'b/manifest.toml': manifest('b', '1.0.0'),
    });
    expect(inspectMods(source, ['b', 'a']).loadOrder).toEqual(['b', 'a']);
  });

  it('karsilanmayan bagimliligi SORUNLU isaretler', () => {
    const source = tinySource({
      'ek/manifest.toml': manifest('ek', '1.0.0', { yok: '*' }),
    });
    const report = inspectMods(source);
    expect(report.packages.find((pkg) => pkg.id === 'ek')?.ok).toBe(false);
    expect(report.packages.find((pkg) => pkg.id === 'base')?.ok).toBe(true);
    expect(report.loadOrder).toEqual(['base']);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]?.mod).toBe('ek');
  });

  it('bagimlilik dongusunu bildirir', () => {
    const source = memorySource({
      'a/manifest.toml': manifest('a', '1.0.0', { b: '*' }),
      'b/manifest.toml': manifest('b', '1.0.0', { a: '*' }),
    });
    const report = inspectMods(source);
    expect(report.loadOrder).toEqual([]);
    expect(report.issues.some((issue) => issue.got.startsWith('dongu:'))).toBe(true);
  });

  it('bos kaynakta patlamaz', () => {
    const report = inspectMods(memorySource({}));
    expect(report.packages).toEqual([]);
    expect(report.loadOrder).toEqual([]);
  });

  it('icerik dosyalarini AYRISTIRMAZ: bozuk TOML burada gorunmez', () => {
    // İlk uc asama yalnizca manifestleri okur; govde hatalari `validate` isidir.
    const source = tinySource({ 'base/bozuk.toml': 'bu = = gecersiz\n' });
    expect(inspectMods(source).issues).toEqual([]);
  });
});

describe('inspectContent', () => {
  it('saglikli icerigi ozetler', () => {
    const report = inspectContent(tinySource(), ['base']);
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.summary?.dataHash).toMatch(/^[0-9a-f]{8}$/);
    expect(report.summary?.unitTypeCount).toBe(1);
    expect(report.summary?.factionCount).toBe(1);
    expect(report.summary?.roster).toEqual([{ faction: 'alpha', unitTypes: 1 }]);
  });

  it('TUM hatalari tek gecişte toplar', () => {
    const source = tinySource({
      'base/u.toml': [
        '[unit.walker]',
        'name = ""',
        'maxHealth = -5',
        'speed = "hizli"',
        'turnRate = 0',
        'radius = 0',
        '',
      ].join('\n'),
    });
    const report = inspectContent(source, ['base']);
    expect(report.ok).toBe(false);
    expect(report.summary).toBeUndefined();

    const fields = report.issues
      .filter((issue) => issue.path.startsWith('unit.walker.'))
      .map((issue) => issue.path);
    expect(fields).toEqual([
      'unit.walker.name',
      'unit.walker.maxHealth',
      'unit.walker.speed',
      'unit.walker.turnRate',
      'unit.walker.radius',
    ]);
  });

  it('her hata sorumlu modu ve satiri tasir', () => {
    const source = tinySource({
      'ek/manifest.toml': manifest('ek', '1.0.0', { base: '*' }),
      'ek/x.toml': '[patch.unit.walker]\nspeed = -3.0\n',
    });
    const report = inspectContent(source, ['base', 'ek']);
    const issue = report.issues.find((entry) => entry.path === 'unit.walker.speed');
    expect(issue?.mod).toBe('ek');
    expect(issue?.file).toBe('ek/x.toml');
    expect(issue?.line).toBe(2);
  });

  it('gercek content/base hatasiz gecer', () => {
    const report = inspectContent(nodeSource(contentDir), ['base']);
    expect(report.issues).toEqual([]);
    expect(report.summary?.unitTypeCount).toBe(4);
  });
});

describe('table', () => {
  it('sutunlari hizalar ve sag bosluklari kirpar', () => {
    const lines = table(['a', 'bbb'], [['xx', 'y']]);
    expect(lines[0]).toBe('a   bbb');
    expect(lines[1]).toBe('--  ---');
    expect(lines[2]).toBe('xx  y');
    expect(lines.every((line) => line === line.trimEnd())).toBe(true);
  });

  it('eksik hucreleri bos sayar', () => {
    expect(table(['a', 'b'], [['x']])[2]).toBe('x');
  });
});

describe('formatMods', () => {
  it('paketleri, sirayi ve durumu gosterir', () => {
    const text = formatMods(inspectMods(tinySource()), './content').join('\n');
    expect(text).toContain('icerik  ./content');
    expect(text).toContain('base');
    expect(text).toContain('hazir');
    expect(text).toContain('yukleme sirasi: base');
  });

  it('bos dizini acikca soyler', () => {
    const text = formatMods(inspectMods(memorySource({})), './yok').join('\n');
    expect(text).toContain('Hic icerik paketi bulunamadi.');
    expect(text).toContain('yukleme sirasi: (bos)');
  });

  it('sorunlu paketi isaretler ve hatalari listeler', () => {
    const source = tinySource({ 'ek/manifest.toml': manifest('ek', '1.0.0', { yok: '*' }) });
    const text = formatMods(inspectMods(source), './content').join('\n');
    expect(text).toContain('SORUNLU');
    expect(text).toContain('1 hata — sorumlu mod: ek (1)');
  });
});

describe('formatValidate', () => {
  it('saglikli icerikte dataHash ve ozet gosterir', () => {
    const text = formatValidate(inspectContent(tinySource(), ['base']), './content', ['base']).join(
      '\n',
    );
    expect(text).toContain('hata yok');
    expect(text).toMatch(/dataHash\s+[0-9a-f]{8}/);
    expect(text).toContain('kadro alpha');
  });

  it('hata sayisini ve sorumlu modlari basliga koyar', () => {
    const source = tinySource({
      'ek/manifest.toml': manifest('ek', '1.0.0', { base: '*' }),
      'ek/x.toml': '[patch.unit.walker]\nspeed = -3.0\nradius = -1.0\n',
    });
    const text = formatValidate(inspectContent(source, ['base', 'ek']), './content', [
      'base',
      'ek',
    ]).join('\n');
    expect(text).toContain('2 hata — sorumlu mod: ek (2)');
    expect(text).toContain('ek/x.toml:2');
  });

  it('sorumlu modlari cok olandan aza siralar', () => {
    const source = tinySource({
      'bir/manifest.toml': manifest('bir', '1.0.0', { base: '*' }),
      'bir/x.toml': '[patch.unit.walker]\nspeed = -1.0\n',
      'iki/manifest.toml': manifest('iki', '1.0.0', { base: '*' }),
      'iki/x.toml': '[patch.unit.walker]\nmaxHealth = -1\nradius = -1.0\n',
    });
    const report = inspectContent(source, ['base', 'bir', 'iki']);
    const text = formatValidate(report, './content', ['base']).join('\n');
    expect(text).toMatch(/sorumlu mod: iki \(2\), bir \(1\)/);
  });
});
