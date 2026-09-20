# BFME RTS Engine

Battle for Middle-earth / Rise of the Witch-king tarzı bir RTS için, sıfırdan yazılmış
deterministik bir oyun motoru. TypeScript, Vite, Babylon.js.

**Durum: Faz 0** — ekranda zemin ve interpolasyonlu hareket eden kutular. Mimari
iskelet yerinde, oyun kuralları henüz yok.

## Hukuki durum

Bu depo **orijinal oyunun kodunu veya asset'lerini içermez ve içeremez.**

- EA'ya veya Tolkien Estate'e ait hiçbir asset (model, doku, ses, metin, ikon)
  bu depoya girmez. `.gitignore` `content/*/assets/` yolunu kapatır.
- Orijinal oyunun binary'si decompile veya disassemble edilmez; ondan kod türetilmez.
- Asset'ler ileride (Faz 1) **çalışma anında**, oyuncunun kendi yasal kurulumundan,
  `BFME_GAME_PATH` ortam değişkeniyle gösterilen dizinden okunur. Oyun kopyası
  oyuncunun kendisine aittir ve bu depo tarafından dağıtılmaz.
- `content/` altındaki TOML dosyaları bu proje için yazılmış özgün sayısal verilerdir.

Bu proje EA, Electronic Arts veya Middle-earth Enterprises ile ilişkili değildir,
onlar tarafından desteklenmez veya onaylanmaz.

## Gereksinimler

- Node.js 22.12+ (LTS)
- pnpm 9

## Kurulum

```bash
pnpm install
cp .env.example .env   # isteğe bağlı — .env olmadan da varsayılanlarla çalışır
pnpm dev
```

## Komutlar

| komut                                 | ne yapar                                 |
| ------------------------------------- | ---------------------------------------- |
| `pnpm dev`                            | tarayıcıda dev sunucusu                  |
| `pnpm build`                          | üretim derlemesi                         |
| `pnpm typecheck`                      | tüm paketlerde tip kontrolü              |
| `pnpm lint`                           | katman ve sim saflığı kurallarını zorlar |
| `pnpm test`                           | testler                                  |
| `pnpm test:coverage`                  | kapsam raporu (%70 eşiği)                |
| `pnpm test:golden:update`             | golden dosyalarını yeniden üretir        |
| `pnpm replay --seed 42 --ticks 10000` | headless determinizm doğrulayıcı         |

## Yapı

```
packages/
  sim-math/       Q16.16 fixed-point, PRNG, trig LUT, Vec2
  schema/         zod şemaları
  modloader/      8 aşamalı içerik yükleme boru hattı
  core-sim/       deterministik simülasyon (SoA entity store)
  engine/         render / girdi / dosya soyutlamaları — RTS'i bilmez
  core-present/   sim → görsel köprüsü, interpolasyon
  app/            giriş noktası (Vite)
tools/
  replay/         headless determinizm doğrulayıcı
content/
  base/           vanilla içerik (TOML)
```

Mimari kurallar ve katman bağımlılık yönü için [CLAUDE.md](CLAUDE.md) dosyasına bak.
Bu kurallar `eslint.config.js` tarafından gerçekten zorlanır — ihlal eden kod
`pnpm lint` ile kırılır.

## Modlama

Vanilla içerik (`content/base/`) özel muamele görmez; yükleyici için o da diğer
paketler gibi bir mod'dur. Yeni bir mod `content/<ad>/manifest.toml` ile başlar ve
`VITE_BFME_ENABLED_MODS` ile yükleme sırasına eklenir. Üç birleştirme sözdizimi
desteklenir: tam tanım (`[unit.x]`), alan yaması (`[patch.unit.x]`) ve listeye ekleme
(`[append.faction.y.units]`).

## Lisans

Kod: bu depo için yazılan tüm kaynak kod. Üçüncü taraf içerik yoktur.
