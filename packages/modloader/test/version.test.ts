import { describe, expect, it } from 'vitest';
import { compareVersions, parseVersion, satisfies } from '../src/version';

describe('parseVersion', () => {
  it('gecerli surumleri ayristirir', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseVersion('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
    expect(parseVersion('10.20.30')).toEqual({ major: 10, minor: 20, patch: 30 });
  });

  it('gecersiz bicimde tanimsiz doner', () => {
    for (const bad of ['1', '1.2', '1.2.3.4', 'v1.2.3', '1.2.3-beta', '']) {
      expect(parseVersion(bad)).toBeUndefined();
    }
  });
});

describe('compareVersions', () => {
  const v = (s: string) => parseVersion(s)!;

  it('major, minor, patch sirasiyla karsilastirir', () => {
    expect(compareVersions(v('1.0.0'), v('2.0.0'))).toBe(-1);
    expect(compareVersions(v('2.0.0'), v('1.9.9'))).toBe(1);
    expect(compareVersions(v('1.2.0'), v('1.3.0'))).toBe(-1);
    expect(compareVersions(v('1.2.3'), v('1.2.4'))).toBe(-1);
    expect(compareVersions(v('1.2.3'), v('1.2.3'))).toBe(0);
  });

  it('siralama icin kullanilabilir', () => {
    const sorted = ['1.10.0', '1.2.0', '0.9.9', '2.0.0']
      .map(v)
      .sort(compareVersions)
      .map((x) => `${String(x.major)}.${String(x.minor)}.${String(x.patch)}`);
    expect(sorted).toEqual(['0.9.9', '1.2.0', '1.10.0', '2.0.0']);
  });
});

describe('satisfies', () => {
  it('* her surumu kabul eder', () => {
    expect(satisfies('0.0.1', '*')).toBe(true);
    expect(satisfies('99.0.0', '*')).toBe(true);
  });

  it('tam esitlik', () => {
    expect(satisfies('1.2.3', '1.2.3')).toBe(true);
    expect(satisfies('1.2.3', '=1.2.3')).toBe(true);
    expect(satisfies('1.2.4', '1.2.3')).toBe(false);
  });

  it('karsilastirma operatorleri', () => {
    expect(satisfies('1.2.4', '>1.2.3')).toBe(true);
    expect(satisfies('1.2.3', '>1.2.3')).toBe(false);
    expect(satisfies('1.2.3', '>=1.2.3')).toBe(true);
    expect(satisfies('1.2.2', '<1.2.3')).toBe(true);
    expect(satisfies('1.2.3', '<1.2.3')).toBe(false);
    expect(satisfies('1.2.3', '<=1.2.3')).toBe(true);
  });

  it('caret ayni major icinde kalir', () => {
    expect(satisfies('1.2.3', '^1.2.3')).toBe(true);
    expect(satisfies('1.9.0', '^1.2.3')).toBe(true);
    expect(satisfies('1.2.2', '^1.2.3')).toBe(false);
    expect(satisfies('2.0.0', '^1.2.3')).toBe(false);
    expect(satisfies('0.9.0', '^1.2.3')).toBe(false);
  });

  it('caret 0.x surumlerinde minor icinde kalir', () => {
    expect(satisfies('0.2.4', '^0.2.3')).toBe(true);
    expect(satisfies('0.3.0', '^0.2.3')).toBe(false);
    expect(satisfies('0.2.2', '^0.2.3')).toBe(false);
  });

  it('tilde ayni major.minor icinde kalir', () => {
    expect(satisfies('1.2.9', '~1.2.3')).toBe(true);
    expect(satisfies('1.3.0', '~1.2.3')).toBe(false);
    expect(satisfies('1.2.2', '~1.2.3')).toBe(false);
  });

  it('bozuk surum veya aralik false doner', () => {
    expect(satisfies('bozuk', '*')).toBe(false);
    expect(satisfies('1.2.3', 'en son')).toBe(false);
    expect(satisfies('1.2.3', '>=1.2')).toBe(false);
  });
});
