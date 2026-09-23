/**
 * Vite eklentisinin urettigi sanal modul.
 *
 * İcerik dosyalari derleme aninda okunup buraya gomulur; tarayici dosya
 * sistemine hic dokunmaz.
 */
declare module 'virtual:bfme-content' {
  /** İcerik kokune gore yol -> dosya metni. */
  export const files: Record<string, string>;
}
