/**
 * Metin bindirmesi.
 *
 * Ustune ne yazildigini bilmez: yalnizca satirlari alir ve gosterir.
 * Sayaclari kim doldurursa doldursun, motor onlarin anlamini bilmez.
 */

export interface Overlay {
  /** Gosterilen satirlari degistirir. */
  setLines(lines: readonly string[]): void;
  /** Bindirmeyi DOM'dan kaldirir. */
  dispose(): void;
}

const STYLE = [
  'position:absolute',
  'top:8px',
  'left:8px',
  'padding:6px 10px',
  'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
  'color:#d8dee9',
  'background:rgba(12,14,18,0.72)',
  'border-radius:4px',
  'pointer-events:none',
  'white-space:pre',
  'user-select:none',
].join(';');

/** Verilen kapsayiciya bir bindirme ekler. */
export function createOverlay(parent: HTMLElement): Overlay {
  const element = document.createElement('div');
  element.setAttribute('style', STYLE);
  parent.appendChild(element);

  let previous = '';
  return {
    setLines(lines) {
      const text = lines.join('\n');
      // DOM yazmasi pahalidir; metin degismediyse dokunma.
      if (text === previous) return;
      previous = text;
      element.textContent = text;
    },
    dispose() {
      element.remove();
    },
  };
}
