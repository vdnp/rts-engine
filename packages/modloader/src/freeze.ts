/**
 * Asama 8 — freeze: derin dondur ve FNV-1a ile `dataHash` uret.
 *
 * Donmus icerik, calisma aninda hicbir sistemin veriyi degistiremeyecegini
 * garanti eder. Hash, icerigin kanonik (sirasi sabit) bir serilestirmesi
 * uzerinden hesaplanir; ayni icerik her zaman ayni hash'i verir, mod sirasi
 * degistiginde hash de degisir.
 */
import type { Content, Faction, FactionId, ModInfo, UnitType, UnitTypeId } from '@bfme/schema';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Bir metni FNV-1a ile hash'ler. Kod birimleri iki bayt olarak islenir. */
function hashText(text: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h = fnvByte(h, code & 0xff);
    h = fnvByte(h, (code >>> 8) & 0xff);
  }
  return h;
}

function fnvByte(h: number, byte: number): number {
  const x = (h ^ byte) >>> 0;
  // (x * FNV_PRIME) mod 2^32, Math.imul kullanmadan.
  // x = hi*2^16 + lo oldugundan carpim ((hi*p) << 16) + lo*p seklinde ayrisir;
  // her iki carpim da 2^53'un altinda kaldigi icin tek bir bit bile kaybolmaz.
  const lo = x & 0xffff;
  const hi = x >>> 16;
  return (((hi * FNV_PRIME) << 16) + lo * FNV_PRIME) >>> 0;
}

/**
 * İcerigin kanonik metin temsili. Sirali ve tam; hash bunun uzerinden alinir.
 * Bicim degisirse hash de degisir, bu yuzden bu fonksiyon degistiginde
 * `tools/replay/expected.json` guncellenmelidir.
 */
export function canonicalize(
  mods: readonly ModInfo[],
  unitTypes: readonly UnitType[],
  factions: readonly Faction[],
): string {
  const lines: string[] = [];
  for (const mod of mods) {
    lines.push(`mod|${String(mod.order)}|${mod.id}|${mod.version}|${mod.name}`);
  }
  for (const unit of unitTypes) {
    lines.push(
      [
        'unit',
        String(unit.id),
        unit.key,
        unit.name,
        String(unit.faction),
        String(unit.maxHealth),
        String(unit.speed),
        String(unit.turnRate),
        String(unit.radius),
      ].join('|'),
    );
  }
  for (const faction of factions) {
    lines.push(
      [
        'faction',
        String(faction.id),
        faction.key,
        faction.name,
        faction.color.join(','),
        faction.unitTypes.join(','),
      ].join('|'),
    );
  }
  return lines.join('\n');
}

/** Nesneyi ve altindaki her seyi geri donulmez bicimde dondurur. */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/**
 * Baglanmis parcalardan donmus `Content` uretir.
 *
 * @returns `dataHash` doldurulmus, derin dondurulmus icerik.
 */
export function freeze(parts: {
  readonly mods: readonly ModInfo[];
  readonly unitTypes: readonly UnitType[];
  readonly factions: readonly Faction[];
  readonly unitTypeByKey: Record<string, UnitTypeId>;
  readonly factionByKey: Record<string, FactionId>;
}): Content {
  const dataHash = hashText(canonicalize(parts.mods, parts.unitTypes, parts.factions), FNV_OFFSET);

  return deepFreeze({
    dataHash,
    mods: parts.mods,
    unitTypes: parts.unitTypes,
    factions: parts.factions,
    unitTypeByKey: parts.unitTypeByKey,
    factionByKey: parts.factionByKey,
  });
}

/** `dataHash`'i sekiz haneli onaltilik metne cevirir. */
export function formatHash(hash: number): string {
  return (hash >>> 0).toString(16).padStart(8, '0');
}
