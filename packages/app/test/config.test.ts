import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from '../src/config';

describe('parseConfig — varsayilanlar', () => {
  it('.env OLMADAN calisir', () => {
    const config = parseConfig({});
    expect(config).toEqual({
      logLevel: 'debug',
      enabledMods: ['base'],
      hotReload: true,
      simTrace: false,
      tickRate: 30,
      showStats: true,
      seed: 42,
    });
  });

  it('bos metni varsayilan sayar', () => {
    expect(parseConfig({ VITE_BFME_LOG_LEVEL: '', VITE_BFME_TICK_RATE: '   ' })).toEqual(
      parseConfig({}),
    );
  });

  it('ilgisiz degiskenleri yok sayar', () => {
    expect(parseConfig({ PATH: '/usr/bin', HOME: '/home/x' })).toEqual(parseConfig({}));
  });
});

describe('parseConfig — mantiksal degerler', () => {
  it.each(['true', 'TRUE', '1', 'yes', 'on'])('%s -> true', (raw) => {
    expect(parseConfig({ VITE_BFME_SIM_TRACE: raw }).simTrace).toBe(true);
  });

  it.each(['false', 'FALSE', '0', 'no', 'off'])('%s -> false', (raw) => {
    expect(parseConfig({ VITE_BFME_HOT_RELOAD: raw }).hotReload).toBe(false);
  });

  it('anlamsiz degeri sessizce varsayilana dusurmez', () => {
    expect(() => parseConfig({ VITE_BFME_HOT_RELOAD: 'belki' })).toThrow(ConfigError);
    expect(() => parseConfig({ VITE_BFME_HOT_RELOAD: 'belki' })).toThrow(
      /VITE_BFME_HOT_RELOAD.*"belki"/s,
    );
  });
});

describe('parseConfig — sayilar', () => {
  it('gecerli tick hizini kabul eder', () => {
    expect(parseConfig({ VITE_BFME_TICK_RATE: '60' }).tickRate).toBe(60);
  });

  it('araliktan tasan degeri reddeder', () => {
    expect(() => parseConfig({ VITE_BFME_TICK_RATE: '0' })).toThrow(ConfigError);
    expect(() => parseConfig({ VITE_BFME_TICK_RATE: '1000' })).toThrow(ConfigError);
  });

  it('tam sayi olmayani reddeder', () => {
    expect(() => parseConfig({ VITE_BFME_TICK_RATE: '30.5' })).toThrow(ConfigError);
    expect(() => parseConfig({ VITE_BFME_TICK_RATE: 'hizli' })).toThrow(/1\.\.240/);
  });

  it('tohumu okur', () => {
    expect(parseConfig({ VITE_BFME_SEED: '1234' }).seed).toBe(1234);
    expect(() => parseConfig({ VITE_BFME_SEED: '-1' })).toThrow(ConfigError);
  });
});

describe('parseConfig — gunluk seviyesi', () => {
  it('bilinen seviyeleri kabul eder', () => {
    for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'silent']) {
      expect(parseConfig({ VITE_BFME_LOG_LEVEL: level }).logLevel).toBe(level);
    }
  });

  it('buyuk harfi kabul eder', () => {
    expect(parseConfig({ VITE_BFME_LOG_LEVEL: 'WARN' }).logLevel).toBe('warn');
  });

  it('bilinmeyeni reddeder ve secenekleri sayar', () => {
    expect(() => parseConfig({ VITE_BFME_LOG_LEVEL: 'verbose' })).toThrow(
      /trace \| debug \| info \| warn \| error \| silent/,
    );
  });
});

describe('parseConfig — mod listesi', () => {
  it('virgulle ayirir ve sirayi korur', () => {
    expect(parseConfig({ VITE_BFME_ENABLED_MODS: 'base,alpha,beta' }).enabledMods).toEqual([
      'base',
      'alpha',
      'beta',
    ]);
  });

  it('bosluklari kirpar ve bos ogeleri atar', () => {
    expect(parseConfig({ VITE_BFME_ENABLED_MODS: ' base , , beta ' }).enabledMods).toEqual([
      'base',
      'beta',
    ]);
  });

  it('yalnizca virgullerden olusan listeyi reddeder', () => {
    expect(() => parseConfig({ VITE_BFME_ENABLED_MODS: ',,,' })).toThrow(ConfigError);
  });
});

describe('parseConfig — hata raporu', () => {
  it('birden fazla bozuk degeri tek seferde bildirir', () => {
    try {
      parseConfig({ VITE_BFME_TICK_RATE: 'x', VITE_BFME_LOG_LEVEL: 'y', VITE_BFME_SEED: 'z' });
      expect.unreachable('hata bekleniyordu');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const message = (error as Error).message;
      expect(message).toContain('VITE_BFME_TICK_RATE');
      expect(message).toContain('VITE_BFME_LOG_LEVEL');
      expect(message).toContain('VITE_BFME_SEED');
    }
  });
});
