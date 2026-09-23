/**
 * İcerik denetleme araci.
 *
 *   pnpm devctl mods                  bulunan paketler, surumleri, siralari
 *   pnpm devctl validate --mods base  tam boru hatti, tum hatalar, dataHash
 *
 * Oyunu BASLATMAZ. Oyunu acmak `pnpm dev` olarak kalir; bu arac yalnizca
 * icerigi denetler, dolayisiyla uygulamanin yapilandirma yoluna hic dokunmaz.
 *
 * Her iki komut da sorun bulursa 1 ile cikar, boylece CI'da kullanilabilir.
 */
import path from 'node:path';
import { Command } from 'commander';
// Node dosya kaynagi replay ile PAYLASILIR; ikinci bir gezici yazilmaz.
import { nodeSource } from '../../replay/src/nodeSource.ts';
import { inspectContent, inspectMods } from './inspect';
import { formatMods, formatValidate } from './report';

interface CommonOptions {
  content: string;
  json: boolean;
}

interface ModsOptions extends CommonOptions {
  mods?: string;
}

interface ValidateOptions extends CommonOptions {
  mods: string;
}

function parseModList(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const mods = raw
    .split(',')
    .map((mod) => mod.trim())
    .filter((mod) => mod.length > 0);
  return mods.length === 0 ? undefined : mods;
}

function write(lines: readonly string[]): void {
  process.stdout.write(`${lines.join('\n')}\n`);
}

function defaultContentDir(): string {
  return process.env['BFME_CONTENT_DIR'] ?? './content';
}

const program = new Command();
program.name('devctl').description('İcerik denetleme araci (oyunu baslatmaz)');

program
  .command('mods')
  .description('Bulunan icerik paketlerini, bagimliliklarini ve yukleme sirasini goster')
  .option('--content <dizin>', 'icerik kok dizini', defaultContentDir())
  .option('--mods <liste>', 'yalnizca bu paketleri incele (virgulle ayrilmis)')
  .option('--json', 'ciktiyi JSON olarak yaz', false)
  .action((options: ModsOptions) => {
    const root = path.resolve(process.cwd(), options.content);
    const report = inspectMods(nodeSource(root), parseModList(options.mods));

    if (options.json) {
      process.stdout.write(`${JSON.stringify(report)}\n`);
    } else {
      write(formatMods(report, options.content));
    }
    if (report.issues.length > 0) process.exitCode = 1;
  });

program
  .command('validate')
  .description('Tam yukleme boru hattini kosur ve tum icerik hatalarini raporlar')
  .option('--content <dizin>', 'icerik kok dizini', defaultContentDir())
  .option('--mods <liste>', 'yuklenecek paketler, yukleme sirasinda', 'base')
  .option('--json', 'ciktiyi JSON olarak yaz', false)
  .action((options: ValidateOptions) => {
    const mods = parseModList(options.mods);
    if (mods === undefined) {
      process.stderr.write('--mods: en az bir icerik paketi gerekli.\n');
      process.exitCode = 1;
      return;
    }

    const root = path.resolve(process.cwd(), options.content);
    const report = inspectContent(nodeSource(root), mods);

    if (options.json) {
      process.stdout.write(`${JSON.stringify(report)}\n`);
    } else {
      write(formatValidate(report, options.content, mods));
    }
    if (!report.ok) process.exitCode = 1;
  });

try {
  program.parse(process.argv);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
