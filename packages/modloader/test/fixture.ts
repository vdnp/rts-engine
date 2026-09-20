/**
 * Uc paketlik test fixture'i.
 *
 * Bilerek notr isimler kullanilir: icerik ismi yasagi bu testlere de uygulanir
 * ve zaten yukleyicinin hicbir ismi bilmemesi gerekir.
 *
 *   base   birimleri ve bir fraksiyonu tanimlar
 *   alpha  bir alani yamalar, kadroya yeni birim ekler (patch + append)
 *   beta   var olan bir birimi tamamen yeniden tanimlar (override)
 */

export const BASE_MANIFEST = `id = "base"
name = "Temel Icerik"
version = "1.0.0"
`;

export const BASE_FACTION = `# Duzen fraksiyonu
[faction.order]
name = "Duzen"
color = [200, 180, 60]
units = [
  "spearman",
  "archer",
]
`;

export const BASE_SPEARMAN = `[unit.spearman]
name = "Mizrakci"
maxHealth = 100
speed = 5.0
turnRate = 360.0
radius = 0.5
`;

export const BASE_ARCHER = `[unit.archer]
name = "Okcu"
maxHealth = 70
speed = 6.0
turnRate = 480.0
radius = 0.4
`;

export const ALPHA_MANIFEST = `id = "alpha"
name = "Alfa Modu"
version = "0.3.0"

[dependencies]
base = "^1.0.0"
`;

export const ALPHA_CHANGES = `# spearman'in yalnizca hizini degistirir
[patch.unit.spearman]
speed = 7.5

# kadroya yeni birim ekler
[append.faction.order]
units = ["rider"]

[unit.rider]
name = "Atli"
maxHealth = 120
speed = 9.0
turnRate = 300.0
radius = 0.7
`;

export const BETA_MANIFEST = `id = "beta"
name = "Beta Modu"
version = "2.1.0"

[dependencies]
base = ">=1.0.0"
`;

export const BETA_ARCHER = `# archer'i tamamen yeniden tanimlar
[unit.archer]
name = "Nisanci"
maxHealth = 55
speed = 6.5
turnRate = 520.0
radius = 0.35
`;

/** Tum fixture dosyalari. */
export function fixtureFiles(): Record<string, string> {
  return {
    'base/manifest.toml': BASE_MANIFEST,
    'base/factions/order.toml': BASE_FACTION,
    'base/units/spearman.toml': BASE_SPEARMAN,
    'base/units/archer.toml': BASE_ARCHER,
    'alpha/manifest.toml': ALPHA_MANIFEST,
    'alpha/changes.toml': ALPHA_CHANGES,
    'beta/manifest.toml': BETA_MANIFEST,
    'beta/archer.toml': BETA_ARCHER,
  };
}

/** Sadece `base` paketini iceren kucuk fixture. */
export function baseOnlyFiles(): Record<string, string> {
  return {
    'base/manifest.toml': BASE_MANIFEST,
    'base/factions/order.toml': BASE_FACTION,
    'base/units/spearman.toml': BASE_SPEARMAN,
    'base/units/archer.toml': BASE_ARCHER,
  };
}
