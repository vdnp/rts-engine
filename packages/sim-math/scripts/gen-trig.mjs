/**
 * Trig lookup table codegen.
 *
 * Runtime kodu libm kullanamaz (determinizm). Tablolar burada, derleme oncesi,
 * bir kez uretilir ve `src/trig.lut.ts` olarak commit edilir.
 *
 *   pnpm --filter @bfme/sim-math gen:trig
 *
 * Uretilen dosya elle duzenlenmez. `test/trig.test.ts` icindeki "tam esitlik"
 * testi tablonun bu formulle bire bir ayni oldugunu dogrular.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Q16.16 birim. */
export const FX_ONE = 65536;

/** Tam tur = 65536 BAM (binary angle measurement) birimi. */
export const ANGLE_FULL = 65536;

/** Ceyrek dalga tablosunda kac adim var. */
export const SIN_STEPS = 1024;

/** atan tablosunda kac adim var (oran 0..1 araligi icin). */
export const ATAN_STEPS = 1024;

/**
 * Yuvarlama kurali: yarim yukari (round-half-up), tum tabloda ayni.
 * Testler bu formulu birebir tekrar eder.
 *
 * @param {number} v
 */
export function roundHalfUp(v) {
  return Math.floor(v + 0.5);
}

/**
 * SIN_TABLE[i] = sin(i * pi / (2 * SIN_STEPS)) * 65536, yuvarlanmis.
 * Uzunluk SIN_STEPS + 2: son eleman interpolasyonun i+1 okumasi icin.
 */
export function buildSinTable() {
  const out = new Int32Array(SIN_STEPS + 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = roundHalfUp(Math.sin((i * Math.PI) / (2 * SIN_STEPS)) * FX_ONE);
  }
  return out;
}

/**
 * ATAN_TABLE[j] = atan(j / ATAN_STEPS) / (2*pi) * 65536, yuvarlanmis.
 * 0..1 orani icin 0..8192 BAM (yani 0..45 derece) uretir.
 * Uzunluk ATAN_STEPS + 2: son eleman interpolasyonun j+1 okumasi icin.
 */
export function buildAtanTable() {
  const out = new Int32Array(ATAN_STEPS + 2);
  for (let j = 0; j < out.length; j++) {
    const ratio = j / ATAN_STEPS;
    out[j] = roundHalfUp((Math.atan(ratio) / (2 * Math.PI)) * ANGLE_FULL);
  }
  return out;
}

/**
 * @param {string} name
 * @param {Int32Array} table
 * @param {number} perLine
 */
function emit(name, table, perLine) {
  const lines = [];
  for (let i = 0; i < table.length; i += perLine) {
    lines.push('  ' + Array.from(table.slice(i, i + perLine)).join(', ') + ',');
  }
  return `export const ${name}: Int32Array = new Int32Array([\n${lines.join('\n')}\n]);\n`;
}

function render() {
  return [
    '// URETILMIS DOSYA - ELLE DUZENLEME.',
    '// Kaynak: packages/sim-math/scripts/gen-trig.mjs',
    '// Yeniden uretmek icin: pnpm --filter @bfme/sim-math gen:trig',
    '',
    '/** Ceyrek dalga sin tablosu. Indeks i, aci i * 16 BAM birimine karsilik gelir. */',
    emit('SIN_TABLE', buildSinTable(), 16),
    '/** atan(oran) -> BAM tablosu. Indeks j, oran j/1024 degerine karsilik gelir. */',
    emit('ATAN_TABLE', buildAtanTable(), 16),
  ].join('\n');
}

const target = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'trig.lut.ts',
);

writeFileSync(target, render(), 'utf8');
console.log(`yazildi: ${target}`);
