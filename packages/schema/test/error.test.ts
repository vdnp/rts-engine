import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import {
  ContentError,
  describeValue,
  formatIssue,
  formatIssues,
  toIssues,
  valueAtPath,
} from '../src/error';
import { UnitSchema } from '../src/unit';

/** Test icin sahte satir haritasi: alan yolundan sabit satir numarasi uretir. */
const LINES: Record<string, number> = {
  'unit.soldier.name': 4,
  'unit.soldier.faction': 5,
  'unit.soldier.maxHealth': 6,
  'unit.soldier.speed': 7,
  'unit.soldier.turnRate': 8,
  'unit.soldier.radius': 9,
  'unit.soldier': 3,
};

const lineOf = (path: readonly (string | number)[]): number => LINES[path.join('.')] ?? 0;

const ctx = {
  file: 'alpha/units/soldier.toml',
  mod: 'alpha',
  prefix: ['unit', 'soldier'] as const,
  lineOf,
};

describe('describeValue', () => {
  it.each([
    [undefined, 'tanimsiz'],
    [null, 'null'],
    ['abc', '"abc"'],
    [42, '42'],
    [true, 'true'],
    [1n, '1n'],
    [[1, 2, 3], '3 elemanli dizi'],
    [{ b: 1, a: 2 }, 'tablo {a, b}'],
  ])('%s -> %s', (input, expected) => {
    expect(describeValue(input)).toBe(expected);
  });

  it('nesne anahtarlarini sirali verir (deterministik cikti)', () => {
    expect(describeValue({ z: 1, a: 2, m: 3 })).toBe(describeValue({ a: 2, m: 3, z: 1 }));
  });
});

describe('valueAtPath', () => {
  const root = { a: { b: [10, 20] } };

  it('var olan yolu okur', () => {
    expect(valueAtPath(root, ['a', 'b', 1])).toBe(20);
    expect(valueAtPath(root, [])).toBe(root);
  });

  it('olmayan yolda tanimsiz doner, patlamaz', () => {
    expect(valueAtPath(root, ['a', 'yok'])).toBeUndefined();
    expect(valueAtPath(root, ['a', 'b', 0, 'derin'])).toBeUndefined();
    expect(valueAtPath(null, ['a'])).toBeUndefined();
  });
});

describe('toIssues', () => {
  it('tek hatanin tum alanlarini doldurur', () => {
    const input = {
      name: 'Asker',
      faction: 'alpha',
      maxHealth: 100,
      speed: 'hizli',
      turnRate: 360,
      radius: 0.5,
    };
    const result = UnitSchema.safeParse(input);
    expect(result.success).toBe(false);
    const issues = toIssues(result.error!, input, ctx);

    expect(issues).toHaveLength(1);
    const { message, ...located } = issues[0]!;
    expect(located).toEqual({
      file: 'alpha/units/soldier.toml',
      line: 7,
      path: 'unit.soldier.speed',
      expected: 'number',
      got: '"hizli"',
      mod: 'alpha',
    });
    expect(message).toContain('expected number');
  });

  it('ILK HATADA DURMAZ: bes bozuk alanin besini birden raporlar', () => {
    const input = {
      name: '',
      faction: 'Alpha',
      maxHealth: -5,
      speed: 'hizli',
      turnRate: 360,
      radius: 0,
    };
    const result = UnitSchema.safeParse(input);
    const issues = toIssues(result.error!, input, ctx);

    expect(issues).toHaveLength(5);
    expect(issues.map((i) => i.path)).toEqual([
      'unit.soldier.name',
      'unit.soldier.faction',
      'unit.soldier.maxHealth',
      'unit.soldier.speed',
      'unit.soldier.radius',
    ]);
    expect(issues.map((i) => i.line)).toEqual([4, 5, 6, 7, 9]);
    for (const issue of issues) {
      expect(issue.mod).toBe('alpha');
      expect(issue.file).toBe('alpha/units/soldier.toml');
      expect(issue.expected.length).toBeGreaterThan(0);
      expect(issue.got.length).toBeGreaterThan(0);
    }
  });

  it('beklenen tarifleri hata turune gore uretir', () => {
    const input = { name: 'x', faction: 'a', maxHealth: 0, speed: 1, turnRate: 1, radius: 1 };
    const issues = toIssues(UnitSchema.safeParse(input).error!, input, ctx);
    expect(issues[0]?.expected).toBe('number > 0');
    expect(issues[0]?.got).toBe('0');

    const tooBig = { ...input, maxHealth: 5, speed: 2000 };
    const bigIssues = toIssues(UnitSchema.safeParse(tooBig).error!, tooBig, ctx);
    expect(bigIssues[0]?.expected).toBe('number <= 1000');
  });

  it('fazladan alani ve adini raporlar', () => {
    const input = {
      name: 'x',
      faction: 'a',
      maxHealth: 5,
      speed: 1,
      turnRate: 1,
      radius: 1,
      hiz: 9,
    };
    const issues = toIssues(UnitSchema.safeParse(input).error!, input, ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.expected).toBe('bilinen bir alan');
    expect(issues[0]?.got).toBe('fazladan alan: hiz');
    expect(issues[0]?.path).toBe('unit.soldier');
    expect(issues[0]?.line).toBe(3);
  });

  it('satir haritasi yoksa 0 yazar, patlamaz', () => {
    const input = { name: 'x', faction: 'a', maxHealth: 5, speed: -1, turnRate: 1, radius: 1 };
    const issues = toIssues(UnitSchema.safeParse(input).error!, input, {
      file: 'x.toml',
      mod: 'x',
    });
    expect(issues[0]?.line).toBe(0);
    expect(issues[0]?.path).toBe('speed');
  });

  it('ayni girdi ayni listeyi uretir (deterministik)', () => {
    const input = { name: '', faction: 'A', maxHealth: -1, speed: -1, turnRate: 1, radius: 1 };
    const a = toIssues(UnitSchema.safeParse(input).error!, input, ctx);
    const b = toIssues(UnitSchema.safeParse(input).error!, input, ctx);
    expect(a).toEqual(b);
  });
});

describe('bicimlendirme', () => {
  const issue = {
    file: 'alpha/units/soldier.toml',
    line: 7,
    path: 'unit.soldier.speed',
    expected: 'number',
    got: '"hizli"',
    mod: 'alpha',
    message: 'Invalid input',
  };

  it('formatIssue konumu ve alanlari gosterir', () => {
    const text = formatIssue(issue);
    expect(text).toContain('alpha/units/soldier.toml:7');
    expect(text).toContain('unit.soldier.speed');
    expect(text).toContain('beklenen: number');
    expect(text).toContain('bulunan : "hizli"');
    expect(text).toContain('mod     : alpha');
  });

  it('satir bilinmiyorsa iki nokta yazmaz', () => {
    expect(formatIssue({ ...issue, line: 0 })).toContain('alpha/units/soldier.toml  unit');
  });

  it('formatIssues sayiyi basliga koyar', () => {
    expect(formatIssues([])).toBe('hata yok');
    expect(formatIssues([issue, issue])).toContain('2 icerik hatasi:');
  });

  it('ContentError hatalari tasir ve mesaji bicimler', () => {
    const err = new ContentError([issue]);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ContentError');
    expect(err.issues).toHaveLength(1);
    expect(err.message).toContain('1 icerik hatasi:');
  });
});

describe('daha az rastlanan zod hata turleri', () => {
  const localCtx = { file: 'x.toml', mod: 'x' };

  it('sembol ve fonksiyon degerlerini tarif eder', () => {
    expect(describeValue(Symbol('s'))).toBe('symbol');
    expect(describeValue(() => 1)).toBe('function');
  });

  it('secenek disi deger (invalid_value)', () => {
    const schema = z.enum(['kuzey', 'guney']);
    const issues = toIssues(schema.safeParse('bati').error!, 'bati', localCtx);
    expect(issues[0]?.expected).toBe('su degerlerden biri: "kuzey", "guney"');
    expect(issues[0]?.got).toBe('"bati"');
  });

  it('kat olmayan sayi (not_multiple_of)', () => {
    const schema = z.number().multipleOf(5);
    const issues = toIssues(schema.safeParse(7).error!, 7, localCtx);
    expect(issues[0]?.expected).toBe('5 kati');
  });

  it('birlesim disi deger (invalid_union)', () => {
    const schema = z.union([z.number(), z.boolean()]);
    const issues = toIssues(schema.safeParse('metin').error!, 'metin', localCtx);
    expect(issues[0]?.expected).toBe('desteklenen varyantlardan biri');
  });

  it('gecersiz anahtar (invalid_key)', () => {
    const schema = z.record(z.string().regex(/^[a-z]+$/), z.number());
    const input = { BAD: 1 };
    const issues = toIssues(schema.safeParse(input).error!, input, localCtx);
    expect(issues[0]?.expected).toBe('gecerli anahtar/eleman');
  });

  it('bilinmeyen kodda mesaja duser', () => {
    const schema = z.string().refine(() => false, { message: 'ozel kural ihlali' });
    const issues = toIssues(schema.safeParse('a').error!, 'a', localCtx);
    expect(issues[0]?.expected).toBe('ozel kural ihlali');
  });
});
