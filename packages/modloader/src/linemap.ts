/**
 * TOML kaynak metninden alan yolu -> satir numarasi haritasi.
 *
 * `smol-toml` konum bilgisi vermez, bu yuzden satir numaralari ham metin
 * taranarak cikarilir. Bu harita YALNIZCA hata mesajlari icindir; eksik veya
 * yaklasik bir eslesme dogrulugu degil, sadece mesaj kalitesini etkiler.
 *
 * Tarayici TOML'un tam dilbilgisini uygulamaz ama su durumlari dogru gecer:
 * yorumlar, tek ve cift tirnakli metinler, kacis dizileri, uc tirnakli cok
 * satirli metinler, satira yayilan diziler ve satir ici tablolar, noktali ve
 * tirnakli anahtarlar, tablo dizileri (`[[a]]` -> `a.0`, `a.1`, ...).
 */

export interface LineMap {
  /**
   * Alan yolunun 1 tabanli satir numarasi. Tam eslesme yoksa ust yollara
   * cikilir (dizi indeksleri ve derin alanlar icin). Hicbiri bulunamazsa 0.
   */
  lineOf(path: readonly (string | number)[]): number;
}

/** Deger taramasinin satirlar arasinda tasidigi durum. */
interface ScanState {
  /** Acik uc tirnakli metnin kapatici dizisi; yoksa null. */
  multiline: string | null;
  /** Kapanmamis `[` ve `{` sayisi. */
  depth: number;
}

/**
 * Bir satirin deger kismini tarar ve durumu gunceller.
 * Yorumlari, metinleri ve parantez derinligini dogru takip eder.
 */
function scanValue(text: string, state: ScanState): void {
  let i = 0;
  while (i < text.length) {
    if (state.multiline !== null) {
      const close = text.indexOf(state.multiline, i);
      if (close === -1) return;
      i = close + state.multiline.length;
      state.multiline = null;
      continue;
    }

    const ch = text[i];
    if (ch === '#') return;

    if (ch === '"' || ch === "'") {
      const triple = text.slice(i, i + 3);
      if (triple === '"""' || triple === "'''") {
        const close = text.indexOf(triple, i + 3);
        if (close === -1) {
          state.multiline = triple;
          return;
        }
        i = close + 3;
        continue;
      }
      i = skipSingleLineString(text, i, ch === '"');
      continue;
    }

    if (ch === '[' || ch === '{') state.depth++;
    else if (ch === ']' || ch === '}') state.depth--;
    i++;
  }
}

/** Acilis tirnagindan kapanis tirnaginin bir sonrasina atlar. */
function skipSingleLineString(text: string, start: number, escapes: boolean): number {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (escapes && ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    i++;
  }
  return text.length;
}

/**
 * Noktali anahtari parcalarina ayirir: `a."b c".d` -> `['a', 'b c', 'd']`.
 * Bicim bozuksa elde edilebilen parcalar dondurulur.
 */
function parseKeyPath(text: string): string[] {
  const parts: string[] = [];
  let i = 0;
  let current = '';
  let started = false;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const end = skipSingleLineString(text, i, ch === '"');
      current += unquote(text.slice(i, end), ch === '"');
      started = true;
      i = end;
      continue;
    }
    if (ch === '.') {
      parts.push(current.trim());
      current = '';
      started = false;
      i++;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }
    current += ch;
    started = true;
    i++;
  }
  if (started || parts.length > 0) parts.push(current.trim());
  return parts.filter((p) => p.length > 0);
}

/** Tirnakli anahtar parcasindan tirnaklari ve kacislari cikarir. */
function unquote(text: string, escapes: boolean): string {
  const inner = text.slice(1, text.length - 1);
  if (!escapes) return inner;
  return inner.replace(/\\(.)/g, (_all, ch: string) => {
    switch (ch) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      default:
        return ch;
    }
  });
}

/** Satirdaki, metin disinda kalan ilk `=` isaretinin konumu; yoksa -1. */
function findAssignment(text: string): number {
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '#') return -1;
    if (ch === '"' || ch === "'") {
      i = skipSingleLineString(text, i, ch === '"');
      continue;
    }
    if (ch === '=') return i;
    i++;
  }
  return -1;
}

/** Tablo basligini ayristirir: `[[a.b]]` -> `{ path, isArray }`. */
function parseHeader(trimmed: string): { path: string[]; isArray: boolean } | undefined {
  const isArray = trimmed.startsWith('[[');
  const open = isArray ? 2 : 1;
  const closeToken = isArray ? ']]' : ']';
  const close = trimmed.lastIndexOf(closeToken);
  if (close < open) return undefined;
  const path = parseKeyPath(trimmed.slice(open, close));
  return path.length === 0 ? undefined : { path, isArray };
}

/** Ham TOML metninden satir haritasi kurar. */
export function buildLineMap(text: string): LineMap {
  const lines = text.split('\n');
  const map = new Map<string, number>();
  const arrayCounts = new Map<string, number>();
  const state: ScanState = { multiline: null, depth: 0 };
  let table: string[] = [];

  const record = (path: readonly string[], lineNumber: number): void => {
    const key = path.join('.');
    if (!map.has(key)) map.set(key, lineNumber);
  };

  for (let index = 0; index < lines.length; index++) {
    const raw = (lines[index] ?? '').replace(/\r$/, '');
    const lineNumber = index + 1;

    if (state.multiline !== null || state.depth > 0) {
      scanValue(raw, state);
      continue;
    }

    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('[')) {
      const header = parseHeader(trimmed);
      if (header === undefined) continue;
      if (header.isArray) {
        const base = header.path.join('.');
        const next = arrayCounts.get(base) ?? 0;
        arrayCounts.set(base, next + 1);
        table = [...header.path, String(next)];
      } else {
        table = header.path;
      }
      record(table, lineNumber);
      continue;
    }

    const eq = findAssignment(trimmed);
    if (eq === -1) continue;
    const keyPath = parseKeyPath(trimmed.slice(0, eq));
    if (keyPath.length > 0) record([...table, ...keyPath], lineNumber);
    scanValue(trimmed.slice(eq + 1), state);
  }

  return {
    lineOf(path) {
      for (let end = path.length; end >= 0; end--) {
        const line = map.get(path.slice(0, end).join('.'));
        if (line !== undefined) return line;
      }
      return 0;
    },
  };
}
