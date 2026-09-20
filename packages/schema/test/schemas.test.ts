import { describe, expect, it } from 'vitest';
import { FactionSchema } from '../src/faction';
import { ManifestSchema } from '../src/manifest';
import { SLUG_PATTERN, VERSION_PATTERN, VERSION_RANGE_PATTERN } from '../src/primitives';
import { UnitSchema } from '../src/unit';

describe('temel bicimler', () => {
  it('slug bicimi', () => {
    for (const ok of ['a', 'alpha', 'alpha_two', 'a1', 'x_9_y']) {
      expect(SLUG_PATTERN.test(ok)).toBe(true);
    }
    for (const bad of ['', 'A', 'Alpha', '1abc', '_a', 'a-b', 'a b', 'a.b', 'aÜ']) {
      expect(SLUG_PATTERN.test(bad)).toBe(false);
    }
  });

  it('surum bicimi', () => {
    for (const ok of ['0.0.0', '1.2.3', '10.20.30']) {
      expect(VERSION_PATTERN.test(ok)).toBe(true);
    }
    for (const bad of ['1', '1.2', '1.2.3.4', 'v1.2.3', '1.2.3-beta', '^1.2.3']) {
      expect(VERSION_PATTERN.test(bad)).toBe(false);
    }
  });

  it('surum araligi bicimi', () => {
    for (const ok of [
      '*',
      '1.2.3',
      '=1.2.3',
      '>1.2.3',
      '>=1.2.3',
      '<1.2.3',
      '<=1.2.3',
      '^1.2.3',
      '~1.2.3',
    ]) {
      expect(VERSION_RANGE_PATTERN.test(ok)).toBe(true);
    }
    for (const bad of ['', '**', '>=1.2', '1.2.3 - 2.0.0', '>= 1.2.3', '^v1.2.3']) {
      expect(VERSION_RANGE_PATTERN.test(bad)).toBe(false);
    }
  });
});

describe('ManifestSchema', () => {
  const valid = { id: 'base', name: 'Temel Icerik', version: '1.0.0' };

  it('en az alanla gecer ve bagimliliklara bos varsayilan verir', () => {
    const r = ManifestSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.dependencies).toEqual({});
  });

  it('tum alanlarla gecer', () => {
    const r = ManifestSchema.safeParse({
      ...valid,
      description: 'aciklama',
      author: 'biri',
      dependencies: { base: '^1.0.0', extra: '*' },
    });
    expect(r.success).toBe(true);
    expect(r.data?.dependencies).toEqual({ base: '^1.0.0', extra: '*' });
  });

  it('bilinmeyen alani reddeder', () => {
    const r = ManifestSchema.safeParse({ ...valid, surprise: 1 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.code).toBe('unrecognized_keys');
  });

  it('bozuk kimlik, surum ve bagimlilik araligini reddeder', () => {
    expect(ManifestSchema.safeParse({ ...valid, id: 'Base' }).success).toBe(false);
    expect(ManifestSchema.safeParse({ ...valid, version: '1.0' }).success).toBe(false);
    expect(ManifestSchema.safeParse({ ...valid, dependencies: { base: 'en son' } }).success).toBe(
      false,
    );
  });
});

describe('UnitSchema', () => {
  const valid = {
    name: 'Asker',
    maxHealth: 100,
    speed: 5,
    turnRate: 360,
    radius: 0.5,
  };

  it('gecerli tanim', () => {
    const r = UnitSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data).toEqual(valid);
  });

  it('hiz sifir olabilir, negatif olamaz', () => {
    expect(UnitSchema.safeParse({ ...valid, speed: 0 }).success).toBe(true);
    expect(UnitSchema.safeParse({ ...valid, speed: -1 }).success).toBe(false);
  });

  it('maxHealth tam sayi ve pozitif olmali', () => {
    expect(UnitSchema.safeParse({ ...valid, maxHealth: 1.5 }).success).toBe(false);
    expect(UnitSchema.safeParse({ ...valid, maxHealth: 0 }).success).toBe(false);
  });

  it('yaricap ve donus hizi pozitif olmali', () => {
    expect(UnitSchema.safeParse({ ...valid, radius: 0 }).success).toBe(false);
    expect(UnitSchema.safeParse({ ...valid, turnRate: 0 }).success).toBe(false);
  });

  it('ust sinirlari zorlar', () => {
    expect(UnitSchema.safeParse({ ...valid, speed: 1001 }).success).toBe(false);
    expect(UnitSchema.safeParse({ ...valid, radius: 101 }).success).toBe(false);
    expect(UnitSchema.safeParse({ ...valid, turnRate: 3601 }).success).toBe(false);
  });

  it('eksik alanlari reddeder', () => {
    const { speed: _omitted, ...withoutSpeed } = valid;
    const r = UnitSchema.safeParse(withoutSpeed);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['speed']);
  });
});

describe('FactionSchema', () => {
  const valid = { name: 'Alfa', color: [200, 30, 30] };

  it('birim listesine bos varsayilan verir', () => {
    const r = FactionSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.units).toEqual([]);
  });

  it('birim listesini kabul eder', () => {
    const r = FactionSchema.safeParse({ ...valid, units: ['soldier', 'archer'] });
    expect(r.data?.units).toEqual(['soldier', 'archer']);
  });

  it('renk uc kanal ve 0-255 olmali', () => {
    expect(FactionSchema.safeParse({ ...valid, color: [1, 2] }).success).toBe(false);
    expect(FactionSchema.safeParse({ ...valid, color: [1, 2, 3, 4] }).success).toBe(false);
    expect(FactionSchema.safeParse({ ...valid, color: [1, 2, 256] }).success).toBe(false);
    expect(FactionSchema.safeParse({ ...valid, color: [1, 2, -1] }).success).toBe(false);
    expect(FactionSchema.safeParse({ ...valid, color: [1, 2, 1.5] }).success).toBe(false);
  });

  it('bozuk birim kimligini reddeder', () => {
    expect(FactionSchema.safeParse({ ...valid, units: ['Soldier'] }).success).toBe(false);
  });
});
