import { chunkName, latin1, sampleW3dFile, writeBigArchive, writeW3dChunks } from '@bfme/formats';
import { describe, expect, it } from 'vitest';
import {
  extractEntry,
  formatBigListing,
  formatW3dDump,
  humanSize,
  looksLikeBig,
} from '../src/formats';

const text = (value: string): Uint8Array =>
  Uint8Array.from(value, (character) => character.charCodeAt(0));

/** "ABCD" ureten, elle kurulmus RefPack akisi. */
const COMPRESSED = Uint8Array.from([0x10, 0xfb, 0, 0, 4, 0xe0, 0x41, 0x42, 0x43, 0x44, 0xfc]);

/** Ters boli. Arsivlerde yol ayraci budur; kacis karmasasindan kacinilir. */
const BS = String.fromCharCode(92);

const archive = writeBigArchive([
  { name: `art${BS}w3d${BS}kutu.w3d`, data: text('W3D') },
  { name: `ini${BS}not.txt`, data: text('DUZ') },
  { name: 'sikisik.dat', data: COMPRESSED },
]);

describe('humanSize', () => {
  it('birimleri secer', () => {
    expect(humanSize(512)).toBe('512 B');
    expect(humanSize(2048)).toBe('2.0 KB');
    expect(humanSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('formatBigListing', () => {
  it('basligi ve girdileri yazar', () => {
    const { lines, entryCount } = formatBigListing(archive, 'deneme.big');
    const output = lines.join('\n');
    expect(entryCount).toBe(3);
    expect(output).toContain('imza    BIGF');
    expect(output).toContain('girdi   3');
    expect(output).toContain(`art${BS}w3d${BS}kutu.w3d`);
  });

  it('sikistirilmis girdiyi isaretler', () => {
    const rows = formatBigListing(archive, 'deneme.big').lines;
    const compressed = rows.find((line) => line.includes('sikisik.dat'));
    const plain = rows.find((line) => line.includes('not.txt'));
    expect(compressed).toContain('evet');
    expect(plain).toContain('—');
  });

  it('filtre uygular', () => {
    const { lines, entryCount } = formatBigListing(archive, 'deneme.big', 'w3d');
    expect(entryCount).toBe(1);
    expect(lines.join('\n')).toContain('(1 eslesme)');
  });

  it('filtre yol ayraci ve harf farkini yok sayar', () => {
    expect(formatBigListing(archive, 'x', 'ART/W3D').entryCount).toBe(1);
  });

  it('eslesme yoksa acikca soyler', () => {
    const { lines, entryCount } = formatBigListing(archive, 'x', 'bulunmaz');
    expect(entryCount).toBe(0);
    expect(lines.join('\n')).toContain('Eslesen girdi yok.');
  });
});

describe('extractEntry', () => {
  it('duz girdiyi cikarir', () => {
    expect(latin1(extractEntry(archive, `ini${BS}not.txt`).data)).toBe('DUZ');
  });

  it('sikistirilmis girdiyi acar', () => {
    const result = extractEntry(archive, 'sikisik.dat');
    expect(latin1(result.data)).toBe('ABCD');
    // ham boyut sikistirilmis haliyle kalir
    expect(result.entry.size).toBe(COMPRESSED.length);
  });

  it('harf ve ayrac farkini yok sayar', () => {
    expect(latin1(extractEntry(archive, 'ART/W3D/KUTU.W3D').data)).toBe('W3D');
  });

  it('olmayan girdide yol gosteren hata verir', () => {
    expect(() => extractEntry(archive, 'yok.dat')).toThrow(/arsivde yok/);
    expect(() => extractEntry(archive, 'yok.dat')).toThrow(/devctl big ls/);
  });
});

describe('formatW3dDump', () => {
  const lines = formatW3dDump(sampleW3dFile(), 'ornek.w3d').join('\n');

  it('dosya ozetini yazar', () => {
    expect(lines).toContain('dosya   ornek.w3d');
    expect(lines).toContain('ust chunk  3');
  });

  it('chunk agacini girintili gosterir', () => {
    expect(lines).toContain('+ MESH');
    expect(lines).toContain('  - MESH_HEADER3');
    expect(lines).toContain('+ HIERARCHY');
    expect(lines).toContain('+ ANIMATION');
  });

  it('chunk sayilarini ozetler', () => {
    expect(lines).toContain('chunk sayilari:');
    expect(lines).toMatch(/ANIMATION_CHANNEL\s+2/);
  });

  it('taninmayan chunk-u onaltilik gosterir', () => {
    const bytes = writeW3dChunks([{ id: 0xabcdef01, data: new Uint8Array(4) }]);
    expect(formatW3dDump(bytes, 'x').join('\n')).toContain(chunkName(0xabcdef01));
  });
});

describe('looksLikeBig', () => {
  it('BIG arsivini taniyi, W3D dosyasini tanimaz', () => {
    expect(looksLikeBig(archive)).toBe(true);
    expect(looksLikeBig(sampleW3dFile())).toBe(false);
  });
});
