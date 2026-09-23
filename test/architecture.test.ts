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
import { LAYERS } from '../eslint.config.js';
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

  it.each([
    ['packages/core-sim/src/__probe__.ts'],
    ['packages/engine/src/__probe__.ts'],
    ['packages/core-present/src/__probe__.ts'],
    ['packages/app/src/__probe__.ts'],
    ['packages/modloader/src/__probe__.ts'],
  ])('%s formats paketini import edemez', async (file) => {
    // formats orijinal oyun bicimlerini cozer ve yalnizca derleme zamani
    // araclari icindir; calisma aninda yalnizca kendi pismis bicimimiz okunur.
    const rules = await rulesTriggeredBy(file, 'import "@bfme/formats";\n');
    expect(rules).toContain('no-restricted-imports');
  });

  it('devctl formats paketini import edebilir', async () => {
    const rules = await rulesTriggeredBy(
      'tools/devctl/src/__probe__.ts',
      'import "@bfme/formats";\n',
    );
    expect(rules).toEqual([]);
  });

  it('formats izni araca gore verilir, tools/** geneline degil', async () => {
    // replay yalnizca sim kosar; bicim cozucusune ihtiyaci yok.
    const rules = await rulesTriggeredBy(
      'tools/replay/src/__probe__.ts',
      'import "@bfme/formats";\n',
    );
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

describe('varsayilan reddet', () => {
  /**
   * Kural bir izin listesidir, kara liste degil.
   *
   * Depoya yeni bir paket eklendiginde hicbir katman onu kendiliginden
   * kabul etmemeli. Bu bir kez ters gitti: `app`'in izin listesi turetilmis
   * oldugu icin yeni eklenen `formats` sessizce iceri girmisti.
   */
  const HAYALI_PAKET = '@bfme/__henuz_yok__';

  it.each(Object.entries(LAYERS))(
    '%s: tabloda yazmayan bir paketi reddeder',
    async (_name, layer) => {
      const rules = await rulesTriggeredBy(
        `${layer.dir}/src/__probe__.ts`,
        `import "${HAYALI_PAKET}";\n`,
      );
      expect(rules).toContain('no-restricted-imports');
    },
  );

  it.each(Object.entries(LAYERS))(
    '%s: izin listesindeki her paketi kabul eder',
    async (_name, layer) => {
      for (const allowed of layer.allow) {
        const rules = await rulesTriggeredBy(
          `${layer.dir}/src/__probe__.ts`,
          `import "@bfme/${allowed}";\n`,
        );
        expect(rules, `izinli olmali: ${allowed}`).toEqual([]);
      }
    },
  );

  it.each(Object.entries(LAYERS))(
    '%s: izin listesinde OLMAYAN her paketi reddeder',
    async (name, layer) => {
      const others = Object.keys(LAYERS).filter(
        (other) =>
          other !== name &&
          !layer.allow.includes(other) &&
          other !== 'replay' &&
          other !== 'devctl',
      );
      for (const denied of others) {
        const rules = await rulesTriggeredBy(
          `${layer.dir}/src/__probe__.ts`,
          `import "@bfme/${denied}";\n`,
        );
        expect(rules, `reddedilmeli: ${denied}`).toContain('no-restricted-imports');
      }
    },
  );

  it('izin listeleri turetilmis DEGIL, acikca yazilmis', () => {
    // `allow: ALL_PACKAGES` gibi bir kisayol, yeni paketi sessizce iceri alir.
    // Hicbir katman tum paketleri birden kabul etmemeli.
    const packageNames = Object.keys(LAYERS);
    for (const [name, layer] of Object.entries(LAYERS)) {
      expect(layer.allow.length, `${name} her seyi kabul ediyor`).toBeLessThan(packageNames.length);
    }
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
