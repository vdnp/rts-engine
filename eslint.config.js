// @ts-check
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * DİKKAT: flat config'te bir kuralın seçenekleri BİRLEŞMEZ, sonraki blok öncekini
 * tamamen ezer. Bu yüzden `no-restricted-syntax` ve `no-restricted-imports` her
 * dosya grubu için tek seferde, birleştirilmiş olarak tanımlanır.
 */

const ALL_PACKAGES = [
  'sim-math',
  'schema',
  'modloader',
  'core-sim',
  'engine',
  'core-present',
  'app',
];

/**
 * Katman bağımlılık matrisi. Bağımlılık yönü tek taraflıdır:
 * content -> core -> engine. Ters import yasak.
 *
 * @type {Record<string, { dir: string; allow: readonly string[]; allowNode?: boolean }>}
 */
const LAYERS = {
  'sim-math': { dir: 'packages/sim-math', allow: [] },
  schema: { dir: 'packages/schema', allow: ['sim-math'] },
  modloader: { dir: 'packages/modloader', allow: ['schema', 'sim-math'] },
  'core-sim': { dir: 'packages/core-sim', allow: ['sim-math', 'schema'] },
  engine: { dir: 'packages/engine', allow: [] },
  'core-present': {
    dir: 'packages/core-present',
    allow: ['sim-math', 'schema', 'core-sim', 'engine'],
  },
  app: { dir: 'packages/app', allow: ALL_PACKAGES },
  replay: {
    dir: 'tools/replay',
    allow: ['sim-math', 'schema', 'modloader', 'core-sim'],
    allowNode: true,
  },
};

const NODE_IMPORTS = {
  group: ['node:*', 'fs', 'path', 'os', 'child_process'],
  message:
    'Tarayicida calisan paketler Node API kullanamaz. Dosya erisimi bir Source arayuzu uzerinden enjekte edilir.',
};

const BABYLON_IMPORTS = {
  group: ['@babylonjs/*'],
  message: 'Babylon sadece packages/engine/src/render/babylon/ altinda import edilebilir.',
};

/**
 * @param {object} opts
 * @param {string} opts.self
 * @param {readonly string[]} opts.allow
 * @param {boolean} [opts.allowNode]
 * @param {boolean} [opts.allowBabylon]
 * @returns {import('eslint').Linter.RuleEntry}
 */
function importRule({ self, allow, allowNode = false, allowBabylon = false }) {
  const patterns = [];
  if (!allowNode) patterns.push(NODE_IMPORTS);
  if (!allowBabylon) patterns.push(BABYLON_IMPORTS);
  return [
    'error',
    {
      paths: ALL_PACKAGES.filter((p) => p !== self && !allow.includes(p)).map((p) => ({
        name: `@bfme/${p}`,
        message: `Katman ihlali: ${self} paketi @bfme/${p} paketini import edemez. Bagimlilik yonu content -> core -> engine.`,
      })),
      patterns,
    },
  ];
}

/** Simülasyonun dokunmasının yasak olduğu global'ler. */
const SIM_FORBIDDEN_GLOBALS = [
  { name: 'Math', message: 'core-sim icinde Math yasak. @bfme/sim-math (SimMath) kullan.' },
  { name: 'Date', message: 'core-sim deterministiktir; duvar saati okuyamaz.' },
  { name: 'performance', message: 'core-sim deterministiktir; duvar saati okuyamaz.' },
  { name: 'setTimeout', message: 'core-sim zamanlayici kullanamaz; sadece tick.' },
  { name: 'setInterval', message: 'core-sim zamanlayici kullanamaz; sadece tick.' },
  { name: 'setImmediate', message: 'core-sim zamanlayici kullanamaz; sadece tick.' },
  { name: 'clearTimeout', message: 'core-sim zamanlayici kullanamaz; sadece tick.' },
  { name: 'clearInterval', message: 'core-sim zamanlayici kullanamaz; sadece tick.' },
  { name: 'queueMicrotask', message: 'core-sim asenkron olamaz.' },
  { name: 'requestAnimationFrame', message: 'core-sim render dongusunu bilmez.' },
  { name: 'cancelAnimationFrame', message: 'core-sim render dongusunu bilmez.' },
  { name: 'fetch', message: 'core-sim G/C yapamaz.' },
  { name: 'XMLHttpRequest', message: 'core-sim G/C yapamaz.' },
  { name: 'WebSocket', message: 'core-sim G/C yapamaz.' },
  { name: 'Worker', message: 'core-sim tek is parcaciginda ve senkron calisir.' },
  { name: 'document', message: 'core-sim DOM bilmez.' },
  { name: 'window', message: 'core-sim DOM bilmez.' },
  { name: 'navigator', message: 'core-sim DOM bilmez.' },
  { name: 'localStorage', message: 'core-sim kalici depolama bilmez.' },
  { name: 'crypto', message: 'core-sim icinde crypto yasak; seeded Rng kullan.' },
  { name: 'process', message: 'core-sim ortam degiskeni okuyamaz.' },
  { name: 'globalThis', message: 'core-sim global duruma erisemez.' },
];

/** Saf simülasyon için sözdizimi yasakları. */
const SIM_SYNTAX = [
  {
    selector: "MemberExpression[object.name='Math']",
    message: 'core-sim icinde Math yasak. @bfme/sim-math kullan.',
  },
  {
    selector: "NewExpression[callee.name='Date']",
    message: 'core-sim deterministiktir; new Date() yasak.',
  },
  {
    selector: 'Literal[raw=/^[0-9]*\\.[0-9]+$/]',
    message: 'core-sim icinde float literal yasak. Q16.16 fixed-point (fx) kullan.',
  },
  {
    selector: 'CallExpression[callee.name=/^(parseFloat|parseInt)$/]',
    message: 'core-sim icinde float/metin ayristirma yasak.',
  },
  {
    selector: "BinaryExpression[operator='/']",
    message: 'core-sim icinde / operatoru yasak (float uretir). Fx.div veya kaydirma (>>) kullan.',
  },
  {
    selector: "AssignmentExpression[operator='/=']",
    message: 'core-sim icinde /= operatoru yasak. Fx.div kullan.',
  },
];

/** sim-math runtime'ı libm kullanamaz; LUT'lar codegen ile üretilir. */
const NO_LIBM = [
  {
    selector: "MemberExpression[object.name='Math']",
    message:
      'sim-math runtime kodu libm kullanamaz. LUT uretimi scripts/ altindaki codegen isidir.',
  },
];

/**
 * Kelime yasağı, kullanıcı kararı gereği identifier düzeyinde \b sınırıyla çalışır:
 * `Unit` yakalanır, `unitCount` yakalanmaz.
 *
 * @param {string} pattern
 * @param {string} message
 */
function forbidWords(pattern, message) {
  return [
    { selector: `Identifier[name=/${pattern}/i]`, message },
    { selector: `Literal[value=/${pattern}/i]`, message },
    { selector: `TemplateElement[value.raw=/${pattern}/i]`, message },
  ];
}

/** İçerik isimleri hiçbir pakette geçemez. */
const CONTENT_NAMES = forbidWords(
  '\\b(gondor|mordor|rohan|isengard|arnor|angmar)\\b',
  'Icerik ismi kodda gecemez. Bu veri content/ altinda yasar.',
);

/** RTS kavramları engine katmanında geçemez. */
const RTS_CONCEPTS = forbidWords(
  '\\b(units?|factions?|hordes?|buildplots?|resources?)\\b',
  'engine katmani bunun bir RTS oldugunu bilmez. Resource yerine Asset konvansiyonunu kullan.',
);

/**
 * @param {ReadonlyArray<{ selector: string; message: string }>} entries
 * @returns {import('eslint').Linter.RuleEntry}
 */
const syntaxRule = (entries) => ['error', ...entries];

// Her paketin taban kuralları: katman importları + içerik ismi yasağı.
const layerConfigs = Object.entries(LAYERS).map(([name, { dir, allow, allowNode }]) => ({
  files: [`${dir}/**/*.ts`],
  rules: {
    'no-restricted-imports': importRule({ self: name, allow, allowNode: allowNode ?? false }),
    'no-restricted-syntax': syntaxRule(CONTENT_NAMES),
  },
}));

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '.cache/**',
    'content/*/assets/**',
  ]),

  // ── Temel TypeScript kuralları (tip bilgisi ile) ────────────────────────
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 10,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // Konfig / codegen betikleri tip bilgisi olmadan linlenir.
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { 'no-console': 'off' },
  },

  // ── Katman taban kuralları ──────────────────────────────────────────────
  ...layerConfigs,

  // ── Paket kaynaklarına özel ek yasaklar (içerik ismi yasağı korunur) ────
  {
    files: ['packages/core-sim/src/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...SIM_FORBIDDEN_GLOBALS],
      'no-restricted-syntax': syntaxRule([...CONTENT_NAMES, ...SIM_SYNTAX]),
    },
  },
  {
    files: ['packages/sim-math/src/**/*.ts'],
    rules: { 'no-restricted-syntax': syntaxRule([...CONTENT_NAMES, ...NO_LIBM]) },
  },
  {
    files: ['packages/engine/src/**/*.ts'],
    rules: { 'no-restricted-syntax': syntaxRule([...CONTENT_NAMES, ...RTS_CONCEPTS]) },
  },

  // ── İstisnalar (en sonda kazanır) ───────────────────────────────────────
  // Babylon adası: tek izinli bölge. Diğer import yasakları burada da geçerli.
  {
    files: ['packages/engine/src/render/babylon/**/*.ts'],
    rules: {
      'no-restricted-imports': importRule({ self: 'engine', allow: [], allowBabylon: true }),
    },
  },
  // Vite eklentileri derleme zamanı kodudur, Node API kullanabilir.
  {
    files: ['packages/app/vite/**/*.ts'],
    rules: {
      'no-restricted-imports': importRule({ self: 'app', allow: ALL_PACKAGES, allowNode: true }),
    },
  },

  // Testler ve araçlar biraz daha serbest.
  {
    files: ['**/test/**/*.ts', 'tools/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
);
