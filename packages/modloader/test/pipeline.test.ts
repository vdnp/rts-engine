import { Fx } from '@bfme/sim-math';
import { describe, expect, it } from 'vitest';
import { canonicalize, formatHash } from '../src/freeze';
import { loadContent } from '../src/pipeline';
import { memorySource } from '../src/source';
import { baseOnlyFiles, fixtureFiles } from './fixture';

const ALL = ['base', 'alpha', 'beta'];

function load(files: Record<string, string>, enabled?: readonly string[]) {
  return loadContent(memorySource(files), enabled === undefined ? {} : { enabled });
}

function loadOk(files: Record<string, string>, enabled?: readonly string[]) {
  const result = load(files, enabled);
  if (!result.ok) {
    throw new Error(`beklenmeyen hata:\n${result.issues.map((i) => i.message).join('\n')}`);
  }
  return result.content;
}

describe('boru hatti — mutlu yol', () => {
  it('uc paketi yukler ve sirayi manifestte bildirir', () => {
    const content = loadOk(fixtureFiles(), ALL);
    expect(content.mods.map((m) => m.id)).toEqual(['base', 'alpha', 'beta']);
    expect(content.mods.map((m) => m.order)).toEqual([0, 1, 2]);
    expect(content.mods[0]?.version).toBe('1.0.0');
  });

  it('sayisal kimlikler alfabetik siralamadan gelir', () => {
    const content = loadOk(fixtureFiles(), ALL);
    expect(content.unitTypes.map((u) => u.key)).toEqual(['archer', 'rider', 'spearman']);
    expect(content.unitTypes.map((u) => u.id)).toEqual([0, 1, 2]);
    expect(content.unitTypeByKey['spearman']).toBe(2);
    expect(content.factionByKey['order']).toBe(0);
  });

  it('sayilari fixed-point ve BAM birimlerine cevirir', () => {
    const content = loadOk(baseOnlyFiles(), ['base']);
    const archer = content.unitTypes[content.unitTypeByKey['archer'] ?? -1];
    expect(archer?.speed).toBe(Fx.of(6));
    expect(archer?.radius).toBe(Fx.of(0.4));
    // 480 derece/saniye = 480/360 tur/saniye = 87381 BAM/saniye
    expect(archer?.turnRate).toBe(87381);
    expect(archer?.maxHealth).toBe(70);
  });
});

describe('birlestirme sozdizimleri', () => {
  it('patch yalnizca yazilan alani degistirir', () => {
    const content = loadOk(fixtureFiles(), ALL);
    const spearman = content.unitTypes[content.unitTypeByKey['spearman'] ?? -1];
    expect(spearman?.speed).toBe(Fx.of(7.5));
    // dokunulmayan alanlar base'den geldigi gibi kalir
    expect(spearman?.name).toBe('Mizrakci');
    expect(spearman?.maxHealth).toBe(100);
    expect(spearman?.radius).toBe(Fx.of(0.5));
  });

  it('tam tanim oncekini tamamen degistirir', () => {
    const content = loadOk(fixtureFiles(), ALL);
    const archer = content.unitTypes[content.unitTypeByKey['archer'] ?? -1];
    expect(archer?.name).toBe('Nisanci');
    expect(archer?.maxHealth).toBe(55);
    expect(archer?.speed).toBe(Fx.of(6.5));
  });

  it('append listeye ekler, mevcutlari silmez', () => {
    const content = loadOk(fixtureFiles(), ALL);
    const faction = content.factions[0];
    const keys = faction?.unitTypes.map((id) => content.unitTypes[id]?.key);
    expect(keys).toEqual(['spearman', 'archer', 'rider']);
  });

  it('yalnizca base yuklenince yama ve ekleme uygulanmaz', () => {
    const content = loadOk(baseOnlyFiles(), ['base']);
    expect(content.unitTypes.map((u) => u.key)).toEqual(['archer', 'spearman']);
    const spearman = content.unitTypes[content.unitTypeByKey['spearman'] ?? -1];
    expect(spearman?.speed).toBe(Fx.of(5));
  });

  it('var olmayan varligi yamalamak hatadir', () => {
    const files = fixtureFiles();
    files['alpha/changes.toml'] = '[patch.unit.yok_boyle_bir_sey]\nspeed = 1.0\n';
    const result = load(files, ALL);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.expected).toContain('unit.yok_boyle_bir_sey');
    expect(result.issues[0]?.mod).toBe('alpha');
    expect(result.issues[0]?.line).toBe(1);
  });

  it('dizi olmayan degere append hatadir', () => {
    const files = fixtureFiles();
    files['alpha/changes.toml'] = '[append.faction.order]\nname = "olmaz"\n';
    const result = load(files, ALL);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.expected).toBe('dizi');
  });

  it('dizi olmayan ALANA append hatadir', () => {
    const files = fixtureFiles();
    files['alpha/changes.toml'] = '[append.faction.order]\nname = ["olmaz"]\n';
    const result = load(files, ALL);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.expected).toBe('dizi alan');
  });
});

describe('hata toplama', () => {
  it('bozuk dosyada bes hatanin besi birden raporlanir', () => {
    const files = baseOnlyFiles();
    files['base/units/spearman.toml'] = [
      '[unit.spearman]',
      'name = ""',
      'maxHealth = -5',
      'speed = "hizli"',
      'turnRate = 0',
      'radius = 0',
      '',
    ].join('\n');

    const result = load(files, ['base']);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const unitIssues = result.issues.filter((i) => i.path.startsWith('unit.spearman.'));
    expect(unitIssues).toHaveLength(5);
    expect(unitIssues.map((i) => i.path)).toEqual([
      'unit.spearman.name',
      'unit.spearman.maxHealth',
      'unit.spearman.speed',
      'unit.spearman.turnRate',
      'unit.spearman.radius',
    ]);
    // satir numaralari ham TOML metnindeki gercek satirlar
    expect(unitIssues.map((i) => i.line)).toEqual([2, 3, 4, 5, 6]);
    for (const issue of unitIssues) {
      expect(issue.file).toBe('base/units/spearman.toml');
      expect(issue.mod).toBe('base');
    }
  });

  it('hatayi yapan modu ve satiri alan bazinda gosterir', () => {
    const files = fixtureFiles();
    files['alpha/changes.toml'] = ALPHA_WITH_BAD_PATCH;
    const result = load(files, ALL);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find((i) => i.path === 'unit.spearman.speed');
    // alan alpha tarafindan yamalandi: hata alpha'ya ve onun satirina yazilmali
    expect(issue?.mod).toBe('alpha');
    expect(issue?.file).toBe('alpha/changes.toml');
    expect(issue?.line).toBe(2);
    expect(issue?.got).toBe('-3');
  });

  it('TOML sozdizimi hatasini satiriyla raporlar', () => {
    const files = baseOnlyFiles();
    files['base/units/archer.toml'] = '[unit.archer]\nname = "Okcu"\nspeed = = 1\n';
    const result = load(files, ['base']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const syntax = result.issues.find((i) => i.expected === 'gecerli TOML');
    expect(syntax?.line).toBe(3);
    expect(syntax?.file).toBe('base/units/archer.toml');
  });

  it('cozulemeyen birim referansi hatadir', () => {
    const files = baseOnlyFiles();
    files['base/factions/order.toml'] = [
      '[faction.order]',
      'name = "Duzen"',
      'color = [1, 2, 3]',
      'units = ["spearman", "archer", "hayalet"]',
      '',
    ].join('\n');
    const result = load(files, ['base']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.issues.find((i) => i.got === '"hayalet"');
    expect(issue?.expected).toBe('tanimli bir birim kimligi');
    expect(issue?.line).toBe(4);
  });

  it('hicbir kadroda gecmeyen birim hatadir', () => {
    const files = baseOnlyFiles();
    files['base/units/oksuz.toml'] = [
      '[unit.oksuz]',
      'name = "Oksuz"',
      'maxHealth = 10',
      'speed = 1.0',
      'turnRate = 1.0',
      'radius = 1.0',
      '',
    ].join('\n');
    const result = load(files, ['base']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.got === 'hicbir kadroda yok')).toBe(true);
  });

  it('iki kadroda birden gecen birim hatadir', () => {
    const files = baseOnlyFiles();
    files['base/factions/ikinci.toml'] = [
      '[faction.second]',
      'name = "Ikinci"',
      'color = [1, 2, 3]',
      'units = ["archer"]',
      '',
    ].join('\n');
    const result = load(files, ['base']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.got.includes('zaten "order" kadrosunda'))).toBe(true);
  });

  it('tur bir tablo degilse hatadir', () => {
    const files = baseOnlyFiles();
    files['base/bozuk.toml'] = ['unit = 5', ''].join('\n');
    const result = load(files, ['base']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.expected === 'tablo' && i.got === 'number')).toBe(true);
  });

  it('gecersiz kimlik bicimi hatadir', () => {
    const files = baseOnlyFiles();
    files['base/bozuk.toml'] = ['[unit."Buyuk Harf"]', 'name = "x"', ''].join('\n');
    const result = load(files, ['base']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.issues.find((i) => i.got === '"Buyuk Harf"');
    expect(issue?.message).toBe('Gecersiz kimlik.');
    expect(issue?.line).toBe(1);
  });

  it('bilinmeyen icerik turu hatadir', () => {
    const files = baseOnlyFiles();
    files['base/uzay.toml'] = '[spaceship.x]\nname = "x"\n';
    const result = load(files, ['base']);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.got === '"spaceship"')).toBe(true);
  });
});

describe('dataHash', () => {
  it('ayni icerik ayni hash', () => {
    const a = loadOk(fixtureFiles(), ALL);
    const b = loadOk(fixtureFiles(), ALL);
    expect(a.dataHash).toBe(b.dataHash);
    expect(formatHash(a.dataHash)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('paket sirasi degisince hash degisir', () => {
    const a = loadOk(fixtureFiles(), ['base', 'alpha', 'beta']);
    const b = loadOk(fixtureFiles(), ['base', 'beta', 'alpha']);
    expect(a.mods.map((m) => m.id)).toEqual(['base', 'alpha', 'beta']);
    expect(b.mods.map((m) => m.id)).toEqual(['base', 'beta', 'alpha']);
    expect(a.dataHash).not.toBe(b.dataHash);
  });

  it('tek bir sayi degisince hash degisir', () => {
    const files = baseOnlyFiles();
    const a = loadOk(files, ['base']);
    files['base/units/archer.toml'] = files['base/units/archer.toml']!.replace(
      'maxHealth = 70',
      'maxHealth = 71',
    );
    const b = loadOk(files, ['base']);
    expect(a.dataHash).not.toBe(b.dataHash);
  });

  it('mod sayisi degisince hash degisir', () => {
    const a = loadOk(baseOnlyFiles(), ['base']);
    const b = loadOk(fixtureFiles(), ALL);
    expect(a.dataHash).not.toBe(b.dataHash);
  });
});

describe('dataHash — bagimsiz referans', () => {
  /** FNV-1a 32 bit, Math.imul ile. Uygulamanin elle yazilmis carpimini denetler. */
  function referenceFnv1a(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      for (const byte of [code & 0xff, (code >>> 8) & 0xff]) {
        h = Math.imul(h ^ byte, 0x01000193) >>> 0;
      }
    }
    return h;
  }

  it('uretilen hash referans FNV-1a ile birebir ayni', () => {
    for (const enabled of [['base'], ALL, ['base', 'beta']]) {
      const content = loadOk(fixtureFiles(), enabled);
      const canonical = canonicalize(content.mods, content.unitTypes, content.factions);
      expect(content.dataHash).toBe(referenceFnv1a(canonical));
    }
  });
});

describe('dondurma', () => {
  it('icerik derin dondurulmustur', () => {
    const content = loadOk(fixtureFiles(), ALL);
    expect(Object.isFrozen(content)).toBe(true);
    expect(Object.isFrozen(content.unitTypes)).toBe(true);
    expect(Object.isFrozen(content.unitTypes[0])).toBe(true);
    expect(Object.isFrozen(content.factions[0]?.unitTypes)).toBe(true);
    expect(Object.isFrozen(content.unitTypeByKey)).toBe(true);
  });

  it('degistirme denemesi katı modda hata firlatir', () => {
    const content = loadOk(fixtureFiles(), ALL);
    const unit = content.unitTypes[0];
    expect(() => {
      (unit as { maxHealth: number }).maxHealth = 1;
    }).toThrow(TypeError);
  });
});

const ALPHA_WITH_BAD_PATCH = `[patch.unit.spearman]
speed = -3.0

[append.faction.order]
units = ["rider"]

[unit.rider]
name = "Atli"
maxHealth = 120
speed = 9.0
turnRate = 300.0
radius = 0.7
`;
