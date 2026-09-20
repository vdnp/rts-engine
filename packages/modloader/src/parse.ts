/**
 * Asama 4 — parse: TOML metni -> ham nesne, satir numarasi korunarak.
 */
import type { ContentIssue } from '@bfme/schema';
import { parse as parseTomlText, TomlError } from 'smol-toml';
import { buildLineMap, type LineMap } from './linemap';

/** Ayristirilmis tek bir icerik dosyasi. */
export interface ParsedFile {
  /** İcerik kokune gore dosya yolu. */
  readonly file: string;
  /** Dosyanin ait oldugu mod'un kimligi. */
  readonly mod: string;
  /** Ham TOML agaci. Henuz dogrulanmamis. */
  readonly data: Readonly<Record<string, unknown>>;
  /** Alan yolundan satir numarasina harita. */
  readonly lines: LineMap;
}

/** `parse` asamasinin sonucu. */
export interface ParseResult {
  /** Basarili ayristirilan dosya; sozdizimi hatasi varsa `undefined`. */
  readonly file: ParsedFile | undefined;
  readonly issues: readonly ContentIssue[];
}

/**
 * Bir TOML dosyasini ayristirir. Sozdizimi hatasi tek bir `ContentIssue`
 * olarak dondurulur; `smol-toml` ilk hatada durdugu icin dosya basina en
 * fazla bir sozdizimi hatasi raporlanabilir.
 */
export function parseFile(file: string, mod: string, text: string): ParseResult {
  try {
    const data = parseTomlText(text);
    return {
      file: { file, mod, data, lines: buildLineMap(text) },
      issues: [],
    };
  } catch (error) {
    return {
      file: undefined,
      issues: [
        {
          file,
          line: error instanceof TomlError ? error.line : 0,
          path: '<dosya>',
          expected: 'gecerli TOML',
          got: 'sozdizimi hatasi',
          mod,
          message: error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error),
        },
      ],
    };
  }
}
