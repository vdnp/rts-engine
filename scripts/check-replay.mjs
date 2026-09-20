// CI determinizm kapisi.
// Replay'i iki kez calistirir, ciktilarin birbirine ve commit edilmis beklenen
// degere esit oldugunu dogrular. Determinizm bozulursa build kirmizi olur.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const replayDir = path.join(repoRoot, 'tools', 'replay');
const expectedPath = path.join(replayDir, 'expected.json');

// Replay araci Faz 0'in son adiminda geliyor. O gelene kadar kapi bekler.
// Arac var olup beklenen deger yoksa bu bir hatadir: kapi sessizce atlanamaz.
if (!existsSync(replayDir)) {
  console.log('replay araci henuz yok; determinizm kapisi arac gelince etkinlesecek.');
  process.exit(0);
}
if (!existsSync(expectedPath)) {
  console.error(`tools/replay var ama ${path.relative(repoRoot, expectedPath)} yok.`);
  console.error('Determinizm kapisi beklenen hash olmadan calisamaz.');
  process.exit(1);
}

/** @type {{ seed: number; ticks: number; mods: string; dataHash: string; finalStateHash: string }} */
const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function runReplay() {
  const stdout = execFileSync(
    pnpm,
    [
      'replay',
      '--seed',
      String(expected.seed),
      '--ticks',
      String(expected.ticks),
      '--mods',
      expected.mods,
      '--json',
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  const line = stdout
    .trim()
    .split('\n')
    .reverse()
    .find((l) => l.trim().startsWith('{'));
  if (!line) {
    throw new Error(`replay JSON ciktisi bulunamadi:\n${stdout}`);
  }
  return JSON.parse(line);
}

const a = runReplay();
const b = runReplay();

const problems = [];
if (a.dataHash !== b.dataHash || a.finalStateHash !== b.finalStateHash) {
  problems.push(
    `Iki calistirma farkli sonuc verdi:\n  A: ${JSON.stringify(a)}\n  B: ${JSON.stringify(b)}`,
  );
}
if (a.dataHash !== expected.dataHash) {
  problems.push(`dataHash beklenenden farkli. beklenen=${expected.dataHash} bulunan=${a.dataHash}`);
}
if (a.finalStateHash !== expected.finalStateHash) {
  problems.push(
    `finalStateHash beklenenden farkli. beklenen=${expected.finalStateHash} bulunan=${a.finalStateHash}`,
  );
}

if (problems.length > 0) {
  console.error('DETERMINIZM IHLALI:\n' + problems.join('\n'));
  console.error(
    '\nIcerigi veya sim kurallarini bilerek degistirdiysen tools/replay/expected.json dosyasini guncelle.',
  );
  process.exit(1);
}

console.log(`determinizm OK  dataHash=${a.dataHash}  finalStateHash=${a.finalStateHash}`);
