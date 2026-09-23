# BFME RTS Engine

Battle for Middle-earth / Rise of the Witch-king tarzı bir RTS için, sıfırdan yazılmış
deterministik bir oyun motoru. TypeScript, Vite, Babylon.js.

**Durum: Faz 1 (spike)** — Faz 0 tamamlandı: ekranda zemin ve interpolasyonlu
hareket eden kutular, deterministik simülasyon, sekiz aşamalı mod yükleyici.
Şu an orijinal oyunun dosya biçimleri (BIG arşiv, W3D chunk ağacı) çözülüyor;
bu aşama ekrana henüz hiçbir şey çizmiyor.

Dosya biçimleri **topluluk dokümantasyonundan ve dosyanın kendisinden**
çözülür; orijinal oyunun binary'si decompile veya disassemble edilmez.
Test fixture'ları kendi yazıcımızla üretilir ve repoya girer.

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
| `pnpm devctl mods`                    | içerik paketleri ve yükleme sırası       |
| `pnpm devctl validate --mods base`    | içerik doğrulayıcı (hata varsa exit 1)   |
| `pnpm devctl big ls <arşiv>`          | BIG arşivini listele                     |
| `pnpm devctl w3d dump <dosya>`        | W3D chunk ağacını yaz                    |

## Determinizm

Simülasyonun saflığı bir iddia değil, çalıştırılabilir bir kontrol:

```bash
$ pnpm replay --seed 42 --ticks 10000 --mods base
dataHash: 6f461038   finalStateHash: 32e494c3   ticks: 10000   varlik: 256   ms: 853
```

Bu araç render'a, DOM'a ve duvar saatine hiç dokunmaz; `@bfme/engine` ve
`@bfme/core-present` paketlerini import etmesi ESLint tarafından engellenir.
Çalışabiliyor olması, sim'in gerçekten tarayıcıdan bağımsız olduğunun kanıtıdır.

CI her derlemede replay'i iki kez koşup sonuçları birbirine ve
`tools/replay/expected.json` içindeki değere karşılaştırır. Determinizm
bozulursa build kırmızı olur. İçeriği veya sim kurallarını bilerek
değiştirdiyseniz beklenen değeri güncelleyin ve commit mesajında gerekçesini
yazın.

## Yapı

```
packages/
  sim-math/       Q16.16 fixed-point, PRNG, trig LUT, Vec2
  schema/         zod şemaları
  modloader/      8 aşamalı içerik yükleme boru hattı
  core-sim/       deterministik simülasyon (SoA entity store)
  engine/         render / girdi / dosya soyutlamaları — RTS'i bilmez
  formats/        BIG / W3D çözücüleri — yalnızca derleme zamanı araçlarında
  core-present/   sim → görsel köprüsü, interpolasyon
  app/            giriş noktası (Vite)
tools/
  replay/         headless determinizm doğrulayıcı
  devctl/         içerik denetleme aracı (oyunu başlatmaz)
content/
  base/           vanilla içerik (TOML)
```

Mimari kurallar ve katman bağımlılık yönü için [CLAUDE.md](CLAUDE.md) dosyasına bak.
Bu kurallar `eslint.config.js` tarafından gerçekten zorlanır — ihlal eden kod
`pnpm lint` ile kırılır.

## Modlama

Vanilla içerik (`content/base/`) özel muamele görmez; yükleyici için o da diğer
paketler gibi bir mod'dur. Yeni bir mod `content/<ad>/manifest.toml` ile başlar ve
`VITE_BFME_ENABLED_MODS` ile yükleme sırasına eklenir. Yükleme sırası bağımlılık
grafiğinin topolojik sıralamasıdır; bağımsız paketlerde bu liste sırayı belirler.

Üç birleştirme sözdizimi desteklenir:

```toml
# 1. Tam tanım — varsa öncekini tamamen değiştirir
[unit.spearman]
name = "Mızrakçı"
maxHealth = 100
speed = 5.0
turnRate = 360.0
radius = 0.5

# 2. Alan yaması — yalnızca yazılan alanı değiştirir, gerisi olduğu gibi kalır
[patch.unit.spearman]
speed = 7.5

# 3. Listeye ekleme — mevcut listeyi silmez, sonuna ekler
[append.faction.order]
units = ["rider"]
```

Ekleme her zaman hedefin bir üst tablosuyla yazılır (`[append.faction.order]` +
`units = [...]`), çünkü TOML'da bir tablo başlığı liste olamaz; etkilenen yol yine
`faction.order.units`'tir.

Bir dosya içinde sıra sabittir: önce tam tanımlar, sonra yamalar, en son eklemeler.

Bir birimin hangi fraksiyona ait olduğu tek kaynaktan, fraksiyonun `units`
listesinden gelir. Her birim tam olarak bir kadroda geçmelidir.

## Lisans

Kod: bu depo için yazılan tüm kaynak kod. Üçüncü taraf içerik yoktur.
