import { describe, expect, it } from 'vitest';
import { buildLineMap } from '../src/linemap';

describe('buildLineMap', () => {
  it('tablo basliklarini ve anahtarlari isaretler', () => {
    const map = buildLineMap(
      ['# yorum', '[unit.soldier]', 'name = "Asker"', 'speed = 5.0', ''].join('\n'),
    );
    expect(map.lineOf(['unit', 'soldier'])).toBe(2);
    expect(map.lineOf(['unit', 'soldier', 'name'])).toBe(3);
    expect(map.lineOf(['unit', 'soldier', 'speed'])).toBe(4);
  });

  it('bulunamayan yolda ust yola cikar', () => {
    const map = buildLineMap(['[a.b]', 'c = 1', ''].join('\n'));
    // dizi indeksi ve olmayan alan: en yakin bilinen ustten cevap verir
    expect(map.lineOf(['a', 'b', 'c', 0])).toBe(2);
    expect(map.lineOf(['a', 'b', 'yok'])).toBe(1);
    expect(map.lineOf(['hicbiri'])).toBe(0);
  });

  it('noktali ve tirnakli anahtarlari coz', () => {
    const map = buildLineMap(['[t]', 'a.b = 1', '"bosluklu ad" = 2', ''].join('\n'));
    expect(map.lineOf(['t', 'a', 'b'])).toBe(2);
    expect(map.lineOf(['t', 'bosluklu ad'])).toBe(3);
  });

  it('satira yayilan diziyi atlar ve sonrasini dogru sayar', () => {
    const map = buildLineMap(
      ['[f.x]', 'units = [', '  "a",', '  "b",', ']', 'name = "X"', ''].join('\n'),
    );
    expect(map.lineOf(['f', 'x', 'units'])).toBe(2);
    expect(map.lineOf(['f', 'x', 'name'])).toBe(6);
  });

  it('uc tirnakli cok satirli metni atlar', () => {
    const map = buildLineMap(
      ['[t]', 'text = """', 'burada = sahte anahtar', '"""', 'gercek = 1', ''].join('\n'),
    );
    expect(map.lineOf(['t', 'text'])).toBe(2);
    expect(map.lineOf(['t', 'gercek'])).toBe(5);
    // cok satirli metnin icindeki satir bir anahtar sayilmamali
    expect(map.lineOf(['t', 'burada'])).toBe(1);
  });

  it('metin icindeki kare parantez ve diyez yanıltmaz', () => {
    const map = buildLineMap(['[t]', 'a = "[ # ]"', 'b = 2', ''].join('\n'));
    expect(map.lineOf(['t', 'a'])).toBe(2);
    expect(map.lineOf(['t', 'b'])).toBe(3);
  });

  it('satir sonu yorumlarini yok sayar', () => {
    const map = buildLineMap(
      ['[t] # baslik yorumu', 'a = 1 # deger yorumu', 'b = 2', ''].join('\n'),
    );
    expect(map.lineOf(['t', 'a'])).toBe(2);
    expect(map.lineOf(['t', 'b'])).toBe(3);
  });

  it('tablo dizilerini indeksler', () => {
    const map = buildLineMap(['[[wave]]', 'n = 1', '', '[[wave]]', 'n = 2', ''].join('\n'));
    expect(map.lineOf(['wave', 0])).toBe(1);
    expect(map.lineOf(['wave', 0, 'n'])).toBe(2);
    expect(map.lineOf(['wave', 1])).toBe(4);
    expect(map.lineOf(['wave', 1, 'n'])).toBe(5);
  });

  it('satir ici tabloyu tek satirda tutar', () => {
    const map = buildLineMap(['[t]', 'p = { x = 1, y = 2 }', 'q = 3', ''].join('\n'));
    expect(map.lineOf(['t', 'p'])).toBe(2);
    expect(map.lineOf(['t', 'q'])).toBe(3);
  });

  it('CRLF satir sonlarini kabul eder', () => {
    const map = buildLineMap('[t]\r\na = 1\r\nb = 2\r\n');
    expect(map.lineOf(['t', 'a'])).toBe(2);
    expect(map.lineOf(['t', 'b'])).toBe(3);
  });

  it('ayni anahtarin ilk gecisini tutar', () => {
    const map = buildLineMap(['[t]', 'a = 1', '[u]', 'a = 2', ''].join('\n'));
    expect(map.lineOf(['t', 'a'])).toBe(2);
    expect(map.lineOf(['u', 'a'])).toBe(4);
  });

  it('bos metinde patlamaz', () => {
    expect(buildLineMap('').lineOf(['a'])).toBe(0);
  });
});
