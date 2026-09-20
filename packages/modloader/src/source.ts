/**
 * İcerik kaynagi soyutlamasi.
 *
 * Modloader dosya sistemine dogrudan dokunmaz. Node tarafi (replay araci) ve
 * tarayici tarafi (Vite eklentisi) bu arayuzu kendi yontemiyle doldurur;
 * boylece boru hatti her iki ortamda ayni kodla, senkron ve saf calisir.
 *
 * Yollar her zaman icerik kokune goredir ve `/` ile ayrilir:
 * `base/manifest.toml`, `base/units/soldier.toml`.
 */

export interface ContentSource {
  /**
   * Kaynaktaki tum dosya yollari. Sira deterministik olmalidir; boru hatti
   * yine de kendi siralamasini uygular, bu yuzden girdi sirasi sonucu
   * etkilemez.
   */
  list(): readonly string[];

  /** Dosyanin UTF-8 icerigi. Dosya yoksa `undefined`. */
  read(path: string): string | undefined;
}

/**
 * Bellekteki bir dosya tablosundan kaynak uretir.
 * Testler, Vite sanal modulu ve onceden okunmus dosyalar icin.
 */
export function memorySource(files: Readonly<Record<string, string>>): ContentSource {
  const paths = Object.keys(files).sort();
  return {
    list: () => paths,
    read: (path) => files[path],
  };
}
