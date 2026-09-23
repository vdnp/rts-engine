/**
 * Bassiz determinizm dogrulayicisi.
 *
 *   pnpm replay --seed 42 --ticks 10000 --mods base
 *
 * Render'a hic dokunmaz. Iki kosunun ayni hash'i vermesi, simulasyonun
 * gercekten deterministik oldugunun kanitidir.
 */
import path from 'node:path';
import { Command } from 'commander';
import { nodeSource } from './nodeSource';
import { ReplayError, runReplay } from './run';

interface CliOptions {
  seed: string;
  ticks: string;
  mods: string;
  content: string;
  json: boolean;
  checkpointEvery: string;
}

function parseIntOption(raw: string, name: string, min: number): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new ReplayError(
      `--${name}: ${String(min)} veya uzeri tam sayi bekleniyordu, "${raw}" bulundu.`,
    );
  }
  return value;
}

function main(argv: readonly string[]): void {
  const program = new Command();
  program
    .name('replay')
    .description('Bassiz determinizm dogrulayicisi')
    .option('--seed <sayi>', 'senaryo tohumu', '42')
    .option('--ticks <sayi>', 'kosulacak tick sayisi', '10000')
    .option('--mods <liste>', 'virgulle ayrilmis icerik paketleri', 'base')
    .option(
      '--content <dizin>',
      'icerik kok dizini',
      process.env['BFME_CONTENT_DIR'] ?? './content',
    )
    .option('--checkpoint-every <sayi>', 'ara hash araligi (0 = kapali)', '0')
    .option('--json', 'ciktiyi JSON olarak yaz', false)
    .allowExcessArguments(false)
    .parse([...argv]);

  const options = program.opts<CliOptions>();
  const seed = parseIntOption(options.seed, 'seed', 0);
  const ticks = parseIntOption(options.ticks, 'ticks', 0);
  const checkpointEvery = parseIntOption(options.checkpointEvery, 'checkpoint-every', 0);
  const mods = options.mods
    .split(',')
    .map((mod) => mod.trim())
    .filter((mod) => mod.length > 0);

  if (mods.length === 0) {
    throw new ReplayError('--mods: en az bir icerik paketi gerekli.');
  }

  const root = path.resolve(process.cwd(), options.content);
  const startedAt = performance.now();
  const result = runReplay({ seed, ticks, mods, source: nodeSource(root), checkpointEvery });
  const elapsedMs = Math.round(performance.now() - startedAt);

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({ ...result, seed, mods: mods.join(','), elapsedMs })}\n`,
    );
    return;
  }

  for (const checkpoint of result.checkpoints) {
    process.stdout.write(
      `tick ${String(checkpoint.tick).padStart(6, ' ')}   hash ${checkpoint.hash}\n`,
    );
  }
  process.stdout.write(
    `dataHash: ${result.dataHash}   finalStateHash: ${result.finalStateHash}   ` +
      `ticks: ${String(result.ticks)}   varlik: ${String(result.entityCount)}   ` +
      `ms: ${String(elapsedMs)}\n`,
  );
}

try {
  main(process.argv);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
