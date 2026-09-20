import { describe, expect, it } from 'vitest';
import { Fx } from '../src/fixed';
import { Angle } from '../src/trig';
import { ATAN_TABLE, SIN_TABLE } from '../src/trig.lut';

const FULL = 65536;
const TWO_PI = Math.PI * 2;

/** BAM -> radyan (referans karsilastirmalari icin). */
const bamToRad = (bam: number): number => (bam / FULL) * TWO_PI;

/** İki BAM acisi arasindaki en kisa fark (isaretli, [-32768, 32768)). */
function angleDelta(a: number, b: number): number {
  let d = (a - b) % FULL;
  if (d > FULL / 2) d -= FULL;
  if (d < -FULL / 2) d += FULL;
  return d;
}

function fnv1a(values: readonly number[]): string {
  let h = 0x811c9dc5;
  for (const v of values) {
    for (let shift = 0; shift < 32; shift += 8) {
      h ^= (v >>> shift) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}

describe('trig LUT — tam esitlik', () => {
  // Codegen formulunun birebir tekrari. Tablo ile bu formul arasinda tek bir
  // ham birim bile fark olamaz.
  it('SIN_TABLE uretim formulune tam esit', () => {
    expect(SIN_TABLE.length).toBe(1026);
    for (let i = 0; i < SIN_TABLE.length; i++) {
      const want = Math.floor(Math.sin((i * Math.PI) / 2048) * 65536 + 0.5);
      expect(SIN_TABLE[i]).toBe(want);
    }
  });

  it('ATAN_TABLE uretim formulune tam esit', () => {
    expect(ATAN_TABLE.length).toBe(1026);
    for (let j = 0; j < ATAN_TABLE.length; j++) {
      const want = Math.floor((Math.atan(j / 1024) / TWO_PI) * FULL + 0.5);
      expect(ATAN_TABLE[j]).toBe(want);
    }
  });

  it('tablo uc degerleri beklenen yerde', () => {
    expect(SIN_TABLE[0]).toBe(0);
    expect(SIN_TABLE[1024]).toBe(65536);
    expect(ATAN_TABLE[0]).toBe(0);
    expect(ATAN_TABLE[1024]).toBe(8192);
  });
});

describe('sin/cos — tolerans', () => {
  it('sin tum tur boyunca libm referansindan en fazla 2 ham birim sapar', () => {
    let worst = 0;
    for (let a = 0; a < FULL; a++) {
      const got = Angle.sin(Angle.raw(a));
      const want = Math.sin(bamToRad(a)) * 65536;
      worst = Math.max(worst, Math.abs(got - want));
    }
    expect(worst).toBeLessThanOrEqual(2);
  });

  it('cos tum tur boyunca libm referansindan en fazla 2 ham birim sapar', () => {
    let worst = 0;
    for (let a = 0; a < FULL; a++) {
      const got = Angle.cos(Angle.raw(a));
      const want = Math.cos(bamToRad(a)) * 65536;
      worst = Math.max(worst, Math.abs(got - want));
    }
    expect(worst).toBeLessThanOrEqual(2);
  });

  it('cember noktalarinda tam degerler', () => {
    expect(Angle.sin(Angle.raw(0))).toBe(0);
    expect(Angle.sin(Angle.QUARTER)).toBe(65536);
    expect(Angle.sin(Angle.HALF)).toBe(0);
    expect(Angle.sin(Angle.raw(49152))).toBe(-65536);
    expect(Angle.cos(Angle.raw(0))).toBe(65536);
    expect(Angle.cos(Angle.QUARTER)).toBe(0);
    expect(Angle.cos(Angle.HALF)).toBe(-65536);
  });

  it('tek fonksiyon simetrisi: sin(-a) === -sin(a)', () => {
    for (let a = 0; a < FULL; a += 7) {
      // `| 0` testin kendi unary eksi isleminin urettigi -0 icin.
      expect(Angle.sin(Angle.raw(-a))).toBe(-(Angle.sin(Angle.raw(a)) as number) | 0);
    }
  });

  it('aci tur sinirlarinda sarilir', () => {
    for (const a of [0, 123, 16384, 40000, 65535]) {
      expect(Angle.sin(Angle.raw(a + FULL))).toBe(Angle.sin(Angle.raw(a)));
      expect(Angle.sin(Angle.raw(a - FULL))).toBe(Angle.sin(Angle.raw(a)));
    }
  });

  it('sin^2 + cos^2 birime yakin', () => {
    for (let a = 0; a < FULL; a += 13) {
      const s = Angle.sin(Angle.raw(a));
      const c = Angle.cos(Angle.raw(a));
      const sum = Fx.add(Fx.mul(s, s), Fx.mul(c, c));
      expect(Math.abs(sum - 65536)).toBeLessThanOrEqual(6);
    }
  });
});

describe('atan2', () => {
  it('eksen yonleri', () => {
    expect(Angle.atan2(Fx.of(0), Fx.of(1))).toBe(0);
    expect(Angle.atan2(Fx.of(1), Fx.of(0))).toBe(16384);
    expect(Angle.atan2(Fx.of(0), Fx.of(-1))).toBe(32768);
    expect(Angle.atan2(Fx.of(-1), Fx.of(0))).toBe(49152);
    expect(Angle.atan2(Fx.of(0), Fx.of(0))).toBe(0);
  });

  it('kosegenler 45 derecenin katlarinda', () => {
    expect(Angle.atan2(Fx.of(1), Fx.of(1))).toBe(8192);
    expect(Angle.atan2(Fx.of(1), Fx.of(-1))).toBe(24576);
    expect(Angle.atan2(Fx.of(-1), Fx.of(-1))).toBe(40960);
    expect(Angle.atan2(Fx.of(-1), Fx.of(1))).toBe(57344);
  });

  it('libm referansindan en fazla 2 BAM birimi sapar', () => {
    let worst = 0;
    for (let a = 0; a < FULL; a += 3) {
      const x = Angle.cos(Angle.raw(a));
      const y = Angle.sin(Angle.raw(a));
      if (x === 0 && y === 0) continue;
      const got = Angle.atan2(y, x);
      const want = ((Math.atan2(y, x) / TWO_PI) * FULL + FULL) % FULL;
      worst = Math.max(worst, Math.abs(angleDelta(got, want)));
    }
    expect(worst).toBeLessThanOrEqual(2);
  });

  it('cikti her zaman [0, 65536) araliginda', () => {
    for (let a = 0; a < FULL; a += 11) {
      const got = Angle.atan2(Angle.sin(Angle.raw(a)), Angle.cos(Angle.raw(a)));
      expect(got).toBeGreaterThanOrEqual(0);
      expect(got).toBeLessThan(FULL);
    }
  });

  it('Fx.MIN girdisinde patlamaz', () => {
    expect(() => Angle.atan2(Fx.MIN, Fx.MIN)).not.toThrow();
    expect(() => Angle.atan2(Fx.MIN, Fx.of(1))).not.toThrow();
  });
});

describe('aci donusumleri', () => {
  it('derece gidis donus', () => {
    expect(Angle.fromDegrees(0)).toBe(0);
    expect(Angle.fromDegrees(90)).toBe(16384);
    expect(Angle.fromDegrees(180)).toBe(32768);
    expect(Angle.fromDegrees(360)).toBe(0);
    expect(Angle.toDegrees(Angle.QUARTER)).toBe(90);
  });

  it('tur ve radyan', () => {
    expect(Angle.ofTurns(0.25)).toBe(16384);
    expect(Angle.toRadians(Angle.HALF)).toBeCloseTo(Math.PI, 10);
    expect(Angle.normalize(Angle.raw(FULL + 5))).toBe(5);
  });
});

describe('trig golden', () => {
  it('tum tur sweep hash ve ornek degerler degismedi', async () => {
    const sin: number[] = [];
    const cos: number[] = [];
    const atan: number[] = [];
    for (let a = 0; a < FULL; a++) {
      const s = Angle.sin(Angle.raw(a));
      const c = Angle.cos(Angle.raw(a));
      sin.push(s);
      cos.push(c);
      atan.push(Angle.atan2(s, c));
    }

    const lines = [
      `sin.fnv1a   ${fnv1a(sin)}`,
      `cos.fnv1a   ${fnv1a(cos)}`,
      `atan2.fnv1a ${fnv1a(atan)}`,
      '',
      '# her 2048 BAM biriminde bir ornek: aci sin cos atan2(sin,cos)',
      ...Array.from({ length: 32 }, (_unused, k) => {
        const a = k * 2048;
        return `${a} ${sin[a]} ${cos[a]} ${atan[a]}`;
      }),
      '',
    ].join('\n');

    await expect(lines).toMatchFileSnapshot('./golden/trig-sweep.txt');
  });
});
