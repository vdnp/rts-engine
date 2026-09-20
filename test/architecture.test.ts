/**
 * Mimari kurallarının gerçekten zorlandığını doğrular.
 *
 * Bu test ESLint'i gerçek `eslint.config.js` ile çalıştırır ve kuralları ihlal eden
 * kaynak metinlerin yakalandığını kontrol eder. Kural gevşetilirse bu test kırılır.
 *
 * Tip-farkındalıklı kurallar kapatılır: burada denetlenen kuralların hiçbiri
 * (no-restricted-globals / -syntax / -imports) tip bilgisine ihtiyaç duymaz ve
 * fixture'lar diskte var olmadığı için TypeScript programına giremezler.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: path.join(repoRoot, 'eslint.config.js'),
  overrideConfig: tseslint.configs.disableTypeChecked,
});

/** Verilen sanal yol için kaynağı linler ve tetiklenen kural adlarını döner. */
async function rulesTriggeredBy(relativePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(repoRoot, relativePath),
    warnIgnored: false,
  });
  if (result === undefined) {
    throw new Error(`ESLint ${relativePath} icin sonuc dondurmedi (yol ignore edilmis olabilir).`);
  }
  return result.messages.map((m) => m.ruleId ?? '<fatal>');
}

const SIM_FILE = 'packages/core-sim/src/__probe__.ts';
const ENGINE_FILE = 'packages/engine/src/__probe__.ts';

describe('core-sim saflığı', () => {
  it('Math.random() kullanımını yakalar', async () => {
    const rules = await rulesTriggeredBy(
      SIM_FILE,
      'export function roll(): number {\n  return Math.random();\n}\n',
    );
    expect(rules).toContain('no-restricted-globals');
    expect(rules).toContain('no-restricted-syntax');
  });

  it.each([
    ['Date.now()', 'export const t = Date.now();\n'],
    ['performance.now()', 'export const t = performance.now();\n'],
    ['setTimeout', 'export const t = setTimeout(() => undefined, 1);\n'],
    ['fetch', 'export const p = fetch("/x");\n'],
    ['document', 'export const e = document.body;\n'],
    ['globalThis', 'export const g = globalThis;\n'],
  ])('%s kullanımını yakalar', async (_label, code) => {
    expect(await rulesTriggeredBy(SIM_FILE, code)).toContain('no-restricted-globals');
  });

  it.each([
    ['float literal', 'export const speed = 1.5;\n'],
    ['bölme operatörü', 'export function half(a: number): number {\n  return a / 2;\n}\n'],
    ['new Date()', 'export const d = new Date();\n'],
    ['parseFloat', 'export const n = parseFloat("1.5");\n'],
  ])('%s kullanımını yakalar', async (_label, code) => {
    expect(await rulesTriggeredBy(SIM_FILE, code)).toContain('no-restricted-syntax');
  });

  it('DOM/Node modüllerini ve ters katman importlarını yakalar', async () => {
    const rules = await rulesTriggeredBy(SIM_FILE, 'import "node:fs";\n');
    expect(rules).toContain('no-restricted-imports');
  });

  it('temiz fixed-point koduna dokunmaz', async () => {
    const rules = await rulesTriggeredBy(
      SIM_FILE,
      'export function step(x: number, v: number): number {\n  return (x + v) | 0;\n}\n',
    );
    expect(rules).toEqual([]);
  });
});

describe('katman bağımlılık yönü', () => {
  it('core-sim -> engine importunu reddeder', async () => {
    const rules = await rulesTriggeredBy(SIM_FILE, 'import "@bfme/engine";\n');
    expect(rules).toContain('no-restricted-imports');
  });

  it('engine -> core-sim importunu reddeder', async () => {
    const rules = await rulesTriggeredBy(ENGINE_FILE, 'import "@bfme/core-sim";\n');
    expect(rules).toContain('no-restricted-imports');
  });

  it('core-sim -> sim-math importuna izin verir', async () => {
    const rules = await rulesTriggeredBy(SIM_FILE, 'import "@bfme/sim-math";\n');
    expect(rules).toEqual([]);
  });

  it('Babylon importunu engine/src/render/babylon dışında reddeder', async () => {
    const rules = await rulesTriggeredBy(ENGINE_FILE, 'import "@babylonjs/core";\n');
    expect(rules).toContain('no-restricted-imports');
  });

  it('Babylon importuna engine/src/render/babylon altında izin verir', async () => {
    const rules = await rulesTriggeredBy(
      'packages/engine/src/render/babylon/__probe__.ts',
      'import "@babylonjs/core";\n',
    );
    expect(rules).toEqual([]);
  });
});

describe('kelime yasakları', () => {
  it('engine içinde RTS kavramlarını yakalar', async () => {
    for (const code of [
      'export interface Unit {\n  id: number;\n}\n',
      'export const faction = 1;\n',
      'export const horde = 1;\n',
      'export const resource = 1;\n',
    ]) {
      expect(await rulesTriggeredBy(ENGINE_FILE, code)).toContain('no-restricted-syntax');
    }
  });

  it('engine içinde Asset konvansiyonuna izin verir', async () => {
    const rules = await rulesTriggeredBy(
      ENGINE_FILE,
      'export interface AssetHandle {\n  id: number;\n}\n',
    );
    expect(rules).toEqual([]);
  });

  it('\\b sınırı gereği bileşik tanımlayıcıları serbest bırakır', async () => {
    // Kural bilinçli olarak identifier düzeyinde \b sınırıyla çalışır.
    const rules = await rulesTriggeredBy(ENGINE_FILE, 'export const unitCount = 1;\n');
    expect(rules).toEqual([]);
  });

  it('sim-math runtime kodunda libm kullanımını yakalar', async () => {
    const rules = await rulesTriggeredBy(
      'packages/sim-math/src/__probe__.ts',
      'export const s = Math.sin(1);\n',
    );
    expect(rules).toContain('no-restricted-syntax');
  });

  it('sim-math testlerinde libm referansına izin verir', async () => {
    const rules = await rulesTriggeredBy(
      'packages/sim-math/test/__probe__.test.ts',
      'export const s = Math.sin(1);\n',
    );
    expect(rules).toEqual([]);
  });

  it('içerik isimlerini her pakette yakalar', async () => {
    for (const file of [SIM_FILE, ENGINE_FILE, 'packages/schema/src/__probe__.ts']) {
      const rules = await rulesTriggeredBy(file, 'export const name = "mordor";\n');
      expect(rules).toContain('no-restricted-syntax');
    }
  });
});

describe('genel TypeScript kuralları', () => {
  it('@ts-ignore ve any kullanımını yakalar', async () => {
    const rules = await rulesTriggeredBy(
      'packages/schema/src/__probe__.ts',
      '// @ts-ignore\nexport const x: any = 1;\n',
    );
    expect(rules).toContain('@typescript-eslint/ban-ts-comment');
    expect(rules).toContain('@typescript-eslint/no-explicit-any');
  });
});
