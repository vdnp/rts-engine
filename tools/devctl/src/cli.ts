/**
 * İcerik denetleme araci.
 *
 *   pnpm devctl mods                  bulunan paketler, surumleri, siralari
 *   pnpm devctl validate --mods base  tam boru hatti, tum hatalar, dataHash
 *   pnpm devctl big ls <arsiv>        BIG arsivindeki dosyalar
 *   pnpm devctl big cat <arsiv> <ad>  bir girdiyi cikar
 *   pnpm devctl w3d dump <dosya>      W3D chunk agaci
 *   pnpm devctl w3d sample <cikti>    ornek W3D fixture'i uret
 *   pnpm devctl big scan [dizin]      kurulumdaki arsivleri tara
 *   pnpm devctl w3d survey [dizin]    gercek W3D dosyalarini chunk duzeyinde gec
 *
 * `scan` ve `survey` oyuncunun KENDI kurulumunu okur (BFME_GAME_PATH).
 * Ciktilari depoya girmez; asset de girmez.
 *
 * Oyunu BASLATMAZ. Oyunu acmak `pnpm dev` olarak kalir; bu arac yalnizca
 * icerigi denetler, dolayisiyla uygulamanin yapilandirma yoluna hic dokunmaz.
 *
 * Her iki komut da sorun bulursa 1 ile cikar, boylece CI'da kullanilabilir.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sampleW3dFile } from '@bfme/formats';
import { Command } from 'commander';
// Node dosya kaynagi replay ile PAYLASILIR; ikinci bir gezici yazilmaz.
import { nodeSource } from '../../replay/src/nodeSource.ts';
import { extractEntry, formatBigListing, formatW3dDump, looksLikeBig } from './formats';
import { formatScan, formatSurvey, scanDirectory, surveyDirectory } from './scan';
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

/** Sayisal secenegi ayristirir; bozuksa okunabilir bir hata verir. */
function parseIntOption(raw: string, name: string, min: number): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(
      `--${name}: ${String(min)} veya uzeri tam sayi bekleniyordu, "${raw}" bulundu.`,
    );
  }
  return value;
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

/** Dosyayi bayt dizisi olarak okur. */
function readBytes(file: string): Uint8Array {
  const buffer = readFileSync(path.resolve(process.cwd(), file));
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

const big = program.command('big').description('BIG arsivlerini incele');

big
  .command('ls <arsiv>')
  .description('Arsivdeki dosyalari listele')
  .option('--filter <metin>', 'adinda bu metni gecen girdileri goster')
  .action((archivePath: string, options: { filter?: string }) => {
    const result = formatBigListing(readBytes(archivePath), archivePath, options.filter);
    write(result.lines);
    if (result.entryCount === 0) process.exitCode = 1;
  });

big
  .command('cat <arsiv> <ad>')
  .description('Bir girdiyi cikar; sikistirilmissa acar')
  .option('--out <dosya>', 'ciktiyi dosyaya yaz (verilmezse stdout)')
  .action((archivePath: string, name: string, options: { out?: string }) => {
    const { entry, data } = extractEntry(readBytes(archivePath), name);
    if (options.out === undefined) {
      process.stdout.write(data);
      return;
    }
    writeFileSync(path.resolve(process.cwd(), options.out), data);
    process.stderr.write(
      `${entry.name}: ${String(entry.size)} ham bayt -> ${String(data.length)} bayt, ${options.out}
`,
    );
  });

/** Oyun kurulumunun kok dizini. */
function defaultGamePath(): string | undefined {
  const configured = process.env['BFME_GAME_PATH'];
  return configured === undefined || configured.trim() === '' ? undefined : configured.trim();
}

/** `--dizin` verilmemisse BFME_GAME_PATH'e duser; ikisi de yoksa hata. */
function resolveGameRoot(given: string | undefined): string | undefined {
  const root = given ?? defaultGamePath();
  if (root === undefined) {
    process.stderr.write(
      'Oyun kurulumunun yolu bilinmiyor. Dizini argüman olarak ver ya da ' +
        'BFME_GAME_PATH ortam degiskenini ayarla.\n',
    );
    process.exitCode = 1;
    return undefined;
  }
  return path.resolve(process.cwd(), root);
}

big
  .command('scan [dizin]')
  .description('Kurulumdaki .big arsivlerini tara (varsayilan: BFME_GAME_PATH)')
  .option('--json', 'ciktiyi JSON olarak yaz', false)
  .action((dir: string | undefined, options: { json: boolean }) => {
    const root = resolveGameRoot(dir);
    if (root === undefined) return;

    const summary = scanDirectory(root);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(summary)}
`);
    } else {
      write(formatScan(summary, root));
    }
    if (summary.failed > 0 || summary.archives.length === 0) process.exitCode = 1;
  });

const w3d = program.command('w3d').description('W3D dosyalarini incele');

w3d
  .command('dump <dosya>')
  .description('Chunk agacini okunabilir metin olarak yaz')
  .action((filePath: string) => {
    const bytes = readBytes(filePath);
    if (looksLikeBig(bytes)) {
      process.stderr.write(
        `${filePath} bir BIG arsivi. Once "devctl big cat" ile girdiyi cikar.
`,
      );
      process.exitCode = 1;
      return;
    }
    write(formatW3dDump(bytes, filePath));
  });

w3d
  .command('sample <cikti>')
  .description("Ornek W3D fixture'i uretir (2 ucgen, 3 kemik, 10 kare)")
  .action((outPath: string) => {
    const bytes = sampleW3dFile();
    writeFileSync(path.resolve(process.cwd(), outPath), bytes);
    process.stderr.write(`${outPath}: ${String(bytes.length)} bayt yazildi
`);
  });

w3d
  .command('survey [dizin]')
  .description('Gercek W3D dosyalarini chunk duzeyinde gec (varsayilan: BFME_GAME_PATH)')
  .option('--limit <sayi>', 'en fazla kac dosya incelenecek', '5000')
  .option('--json', 'ciktiyi JSON olarak yaz', false)
  .action((dir: string | undefined, options: { limit: string; json: boolean }) => {
    const root = resolveGameRoot(dir);
    if (root === undefined) return;

    const limit = parseIntOption(options.limit, 'limit', 1);
    const report = surveyDirectory(root, limit);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report)}
`);
    } else {
      write(formatSurvey(report, root));
    }
    // Ayristirma hatasi varsayimlarimizin tutmadigi anlamina gelir.
    if (report.parseErrors.length > 0) process.exitCode = 1;
  });

try {
  program.parse(process.argv);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
