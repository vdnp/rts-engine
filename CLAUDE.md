# CLAUDE.md

Bu dosya mimariyi korur. Kod yazmadan önce oku. Kurallar tartışmaya kapalıdır.

## Katmanlar

```
content/          sadece veri (TOML). Kod yok.
   │
   ▼
packages/schema      zod şemaları
packages/modloader   8 aşamalı yükleme boru hattı
packages/sim-math    Q16.16 fixed-point, PRNG, trig LUT
packages/core-sim    deterministik simülasyon kuralları
   │
   ▼
packages/core-present  sim → görsel köprüsü (sim state'i READONLY okur)
   │
   ▼
packages/engine      render / girdi / ses / dosya / pencere
```

Bağımlılık yönü tek taraflıdır: **content → core → engine**. Ters import yok.
İzin matrisi `eslint.config.js` içindeki `LAYERS` tablosudur; orası tek gerçek kaynaktır.

| paket          | import edebildikleri                          |
| -------------- | --------------------------------------------- |
| `sim-math`     | —                                             |
| `schema`       | `sim-math`                                    |
| `modloader`    | `schema`, `sim-math`                          |
| `core-sim`     | `sim-math`, `schema`                          |
| `engine`       | —                                             |
| `core-present` | `sim-math`, `schema`, `core-sim`, `engine`    |
| `app`          | hepsi                                         |
| `tools/replay` | `sim-math`, `schema`, `modloader`, `core-sim` |
| `tools/devctl` | `schema`, `modloader`, `formats`              |
| `formats`      | —                                             |

## Değişmez kurallar

1. **engine bunun bir RTS olduğunu bilmez.** `unit`, `faction`, `horde`, `buildplot`,
   `resource` kelimeleri `packages/engine/` içinde geçemez. Varlık yükleme için
   **Asset** konvansiyonu kullanılır: `AssetLoader`, `AssetHandle`. Asla `Resource*`.
2. **İçerik ismi kodda geçmez.** Hiçbir paket içerik ismi (fraksiyon, birim adı)
   hardcode etmez. O veri `content/` altında yaşar.
3. **core-sim saftır.** Yasak: `Math.*`, `Date`, `performance`, timer'lar, `fetch`,
   DOM, `node:*`, float literal, `/` operatörü, `Math.random()`.
   Konum/hız/hasar `Fx` (Q16.16) tipindedir. Rastgelelik sadece seeded `Rng`'dendir.
   `Object` anahtar sırasına veya `Set`/`Map` iterasyon sırasına bağımlı olma.
4. **Sim'in imzası sabittir:** `tick(state, commands, content): void`. Başka hiçbir
   şeye dokunmaz.
5. **Present sim state'ini yazmaz.** Tip `readonly`'dir; `as` ile kırma.
6. **Vanilla da bir moddur.** `content/base/` özel muamele görmez; sadece yükleme
   sırasında ilk gelir. Motorda "base içerik" diye hardcoded hiçbir şey yok.
7. **Content donmuştur.** Yükleme sonunda derin dondurulur ve FNV-1a `dataHash`
   hesaplanır. Çalışma anında hiçbir sistem içerik verisini değiştiremez.
8. **Babylon tek adada.** `@babylonjs/*` importu sadece
   `packages/engine/src/render/babylon/` altında olabilir.
9. **Node API'leri `packages/` içinde yok.** Dosya erişimi bir `Source` arayüzü
   üzerinden enjekte edilir (Node impl `tools/`, tarayıcı impl `packages/app/vite/`).
10. **Asset verisi simülasyona GİRMEZ.** Çarpışma yarıçapı, ölçek, hız gibi
    sim değerleri yalnızca `content/` altındaki TOML'dan gelir; mesh bounding
    box'ından, kemik uzunluğundan veya başka bir model verisinden **asla**
    türetilmez. Bir modelin değişmesi sim davranışını değiştiremez — aksi
    halde determinizm asset dosyalarına bağımlı hale gelir ve replay anlamını
    yitirir. Modelin görsel ölçek faktörü `core-present` içinde yaşar; sim
    onu bilmez.
11. **Katman izinleri varsayılan REDDET.** `LAYERS` tablosundaki `allow`
    listesinde açıkça yazmayan hiçbir paket import edilemez. Türetilmiş liste
    (`allow: ALL_PACKAGES` gibi) kullanılmaz: yeni bir paketi sessizce içeri
    alır. `test/architecture.test.ts` bunu her katman için tek tek sınar.
12. **`@bfme/formats` çalışma anında kullanılmaz.** Orijinal oyunun dosya
    biçimlerini (BIG, W3D) çözer ve yalnızca derleme zamanı araçları içindir.
    `app` dahil hiçbir runtime paketi onu import edemez; izin araç bazında
    verilir (`LAYERS` tablosu). Çalışma anında yalnızca kendi pişmiş
    biçimimiz okunur.

## Sim / present sözleşmesi

- Sim sabit **30 Hz** tick ile koşar. Present ekran hızında koşar.
- Interpolasyon tick `N-1` ve `N` gerektirir. **Sim tek state tutar.** Kopyalama
  present katmanında, tick sınırında `Int32Array.set` ile yapılır:
  `core-present` 2 slotluk transform ring buffer tutar.
- `alpha = acc / TICK_MS`, `[0,1]` aralığına kırpılır.
- Sim'de duvar saati birimi **yoktur**. `core-sim` yalnızca `TICK_RATE` (30) bilir;
  milisaniye ve kare süresi present/app katmanının işidir.
- `SimState` present'e `ReadonlySimState` olarak geçer: tipli dizilerin `set`/`fill`
  gibi yazma yöntemleri o görünümde yoktur, alanlar `readonly`'dir. Present'ten
  yazmak derleme hatasıdır.

## Hot reload semantiği

İçerik dosyası değişince: **içerik baştan yüklenir + sim aynı seed ile sıfırdan
başlatılır.** Çalışan bir sim'in içeriği asla değişmez (determinizm). Ekranda
yeniden başlatma bildirimi gösterilir.

## Golden dosyalar

- Golden'lar `vitest`'in `toMatchFileSnapshot()` mekanizmasıyla `test/golden/`
  altında tutulur.
- **Normal test koşusu golden'ı asla güncellemez.** Güncelleme tek yoldan yapılır:
  `pnpm test:golden:update`. Çıkan diff commit'te gözden geçirilir.
- CI'da `CI=true` olduğu için eksik golden testi kırar.
- `sim-math` trig LUT'u için iki ayrı test bulunur: referans tabloyla **tolerans**
  testi ve commit edilmiş golden ile **tam eşitlik** testi. İkisi de zorunludur.

## Yeni bir sim sistemi eklerken

1. Bileşen gerekiyorsa `packages/core-sim/src/state.ts` içindeki `I32_FIELDS`
   (veya `U8_FIELDS`) listesine alan adını ekle. Dizi ayırma, kapasite büyütme ve
   `hashState()` bu listeden türer — tek yere ekle, üçü birden doğru olur.
2. Sistemi `packages/core-sim/src/systems/<ad>.ts` içine saf fonksiyon olarak yaz:
   `(state, content) => void`. Argüman dışında hiçbir şey okuma.
3. `tick.ts` içinde sistemi **sabit bir sırada** çağır. Sıra determinizmin parçasıdır.
4. Hash'in kör kalmadığını doğrula: alanı değiştirince `hashState()` değişmeli
   (`test/tick.test.ts` bunu her alan için tek tek sınar).
5. Test yaz: davranış testi + 1000 tick golden hash testi.
6. Görselleşmesi gerekiyorsa `core-present` içinde okuyucu ekle. Sim tarafına
   görselle ilgili tek alan ekleme.
7. `pnpm typecheck && pnpm lint && pnpm test && pnpm replay` — dördü de yeşil olmalı.
8. İçerik veya sim kuralları bilerek değiştiyse `tools/replay/expected.json`
   güncellenir ve commit mesajında gerekçesi yazılır.

## Bunu asla yapma

- ❌ `core-sim` içinde float, `Math`, `Date`, `performance`, `Math.random()`
- ❌ `engine` içinden içerik veya RTS kavramı referansı (`unit`, `faction`, `gondor`…)
- ❌ `core-present` içinden sim state mutasyonu
- ❌ `readonly`'yi `as` ile kırmak
- ❌ `any`, `@ts-ignore`, `@ts-nocheck`
- ❌ EA / Tolkien asset'i (model, doku, ses, metin) commit'lemek
- ❌ Orijinal oyun binary'sini decompile / disassemble etmek; biçimler yalnızca
  topluluk dokümantasyonundan ve dosyanın kendisinden çözülür
- ❌ `@bfme/formats`'ı runtime paketlerinden import etmek
- ❌ Test fixture'ı olarak gerçek oyun dosyası commit'lemek; fixture'lar
  `devctl w3d sample` ile üretilir
- ❌ Bölüm listesinde olmayan bağımlılık eklemek (önce sor)
- ❌ TODO / stub / boş klasör bırakmak
- ❌ Golden dosyayı elle düzenlemek

## Komutlar

| komut                                 | ne yapar                                           |
| ------------------------------------- | -------------------------------------------------- |
| `pnpm dev`                            | Vite dev sunucusu, tarayıcıda oyun                 |
| `pnpm build`                          | üretim derlemesi                                   |
| `pnpm typecheck`                      | tüm paketlerde `tsc --noEmit`                      |
| `pnpm lint`                           | ESLint — katman ve saflık kurallarını zorlar       |
| `pnpm test`                           | vitest, tek sefer                                  |
| `pnpm test:watch`                     | vitest izleme modu                                 |
| `pnpm test:coverage`                  | kapsam raporu + %70 eşiği                          |
| `pnpm test:golden:update`             | golden dosyalarını yeniden üretir (tek izinli yol) |
| `pnpm replay --seed 42 --ticks 10000` | headless determinizm doğrulayıcı                   |
| `pnpm devctl mods`                    | içerik paketleri, bağımlılıkları, yükleme sırası   |
| `pnpm devctl validate --mods base`    | tüm içerik hatalarını dosya:satır ile raporlar     |
| `pnpm devctl big ls <arşiv>`          | BIG arşivindeki dosyalar                           |
| `pnpm devctl big cat <arşiv> <ad>`    | bir girdiyi çıkarır (RefPack'i açar)               |
| `pnpm devctl w3d dump <dosya>`        | W3D chunk ağacı                                    |
| `pnpm devctl w3d sample <çıktı>`      | örnek W3D fixture'ı üretir (`--mesh-version`)      |
| `pnpm devctl big scan [dizin]`        | kurulumdaki arşivleri tara                         |
| `pnpm devctl w3d survey [dizin]`      | gerçek W3D'leri chunk düzeyinde geç                |
| `pnpm format`                         | prettier                                           |

`cook` komutu Faz 0'da **yoktur**; Faz 1'de gelecek.

## Faz 1 — biçim çözme (devam ediyor)

Şu an yapılmış olan bir **spike**'tır: BIG arşiv okuyucu ve W3D chunk ağacı
parser'ı. Ekrana hiçbir şey çizilmez. Amaç biçimi gerçekten okuyabildiğimizi
kanıtlamaktı.

- Biçimler topluluk dokümantasyonundan ve dosyanın kendisinden çözülür.
  Decompile edilmiş koddan **türetilmez**.
- Test fixture'ları `@bfme/formats` içindeki kendi yazıcımızla üretilir ve
  repoya girer. EA asset'i asla girmez; `BFME_GAME_PATH` altındaki gerçek
  dosyalar yalnızca elle doğrulama içindir.
- `test/fixtures.test.ts` commit edilmiş fixture'ın üretecin bugünkü
  çıktısıyla birebir aynı olduğunu doğrular — ikisi sessizce ayrılamaz.

### Gerçek dosya doğrulaması (yapıldı, bir tur daha gerekiyor)

Fixture round-trip'i, parser ile yazıcının **birbiriyle** tutarlı olduğunu
kanıtlar — EA'nın dosyalarıyla tutarlı olduğunu değil. `big scan` ve
`w3d survey` bu kör noktayı kapatmak için var; rapor çıktısı repoya
**girmez**, asset de girmez.

İlk tur chunk ID tablosunda birkaç gerçek hata ortaya çıkardı (HLOD ailesi
tamamen kaçırılmıştı, UV koordinatları yanlış ID'ye eşlenmişti). Tablo
iki açık kaynağın birleşimiyle **komple değiştirildi**:

- Westwood `w3d_file.h` — orijinal chunk enum'u
- OpenSAGE Docs `file-formats/w3d/index.rst` — SAGE/BFME eklemeleri

**Chunk ID tablosu hafızadan yazılmaz.** Yeni bir ID eklenecekse kaynaktan
alınır ve nereden geldiği yorumda yazılır. Tanınmayan bir ID'ye isim
uydurulmaz; onaltılık görünmeye devam eder.

Survey'in ölçtükleri: chunk ID histogramı, tanınmayan ID'ler, sürüm
alanları, adım tutarsızlıkları, bildirilen sayı ↔ gövde uyuşmazlığı,
**bayrak tutarsızlığı** (aynı ID'nin hem kapsayıcı hem yaprak görülmesi),
dalınamayan chunk'lar.

### Bilinen sürüm çeşitliliği

Gerçek kurulumda görülen ve fixture üretecinin kapsadığı sürümler:

| chunk                         | sürümler   |
| ----------------------------- | ---------- |
| `MESH_HEADER3`                | 4.2 ve 5.0 |
| `COMPRESSED_ANIMATION_HEADER` | 0.1 ve 1.0 |

13159 mesh üzerinde sayı↔gövde uyuşmazlığı **sıfır** çıktı: `NumTris` ve
`NumVertices` her iki sürümde de aynı konumda (40 ve 44). Bunun ötesindeki
alanlar henüz doğrulanmadı.

### Sonraki sıra (henüz kod yok)

```
mesh çıkarma → STATİK mesh ekranda → iskelet → animasyon → skinned
```

**Statik adım atlanmaz.** Koordinat sistemi (W3D Z-up → Babylon Y-up),
ölçek ve winding order hatalarını skinning'den ayrı izole etmek için.

### Cook biçimi kısıtları (tasarım ilk mesh çıkınca)

- interleaved vertex + index buffer; çalışma anında **sıfır dönüşüm**
- tüm blob offset'leri 4 byte hizalı (typed array view zorunluluğu)
- header: magic + format sürümü + cooker sürümü; uyuşmazsa **reddet**
- cache anahtarı = `hash(kaynak) + cooker sürümü`
- mesh / iskelet / animasyon / doku ayrı blob, ID ile referans
- Faz 1'de sıkıştırma yok; doku DDS olarak kalır

## Kapsam sınırı

**Yok**: pathfinding, savaş, bina, kaynak, ağ, kahraman, horde, WASM,
masaüstü kabuğu, launcher'ın seçim/başlatma yarısı. İleride lazım olacak diye
klasör veya arayüz açma.
