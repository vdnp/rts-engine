import { describe, expect, it } from 'vitest';
import { type LogLevel, createLogger, isEnabled, isLogLevel } from '../src/log';

function collector() {
  const lines: string[] = [];
  return {
    lines,
    sink: (level: string, message: string) => {
      lines.push(`${level}: ${message}`);
    },
  };
}

describe('isLogLevel', () => {
  it('bilinen seviyeleri taniyi', () => {
    for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'silent']) {
      expect(isLogLevel(level)).toBe(true);
    }
  });

  it('bilinmeyeni reddeder', () => {
    expect(isLogLevel('verbose')).toBe(false);
    expect(isLogLevel('')).toBe(false);
    expect(isLogLevel('toString')).toBe(false);
  });
});

describe('isEnabled', () => {
  it('esigin altindaki seviyeleri susturur', () => {
    expect(isEnabled('debug', 'info')).toBe(false);
    expect(isEnabled('info', 'info')).toBe(true);
    expect(isEnabled('error', 'info')).toBe(true);
  });

  it('silent her seyi susturur', () => {
    for (const level of ['trace', 'debug', 'info', 'warn', 'error'] as const) {
      expect(isEnabled(level, 'silent')).toBe(false);
    }
  });
});

describe('createLogger', () => {
  it('esigin uzerindeki satirlari yazar', () => {
    const { lines, sink } = collector();
    const log = createLogger('warn', sink);
    log.trace('a');
    log.debug('b');
    log.info('c');
    log.warn('d');
    log.error('e');
    expect(lines).toEqual(['warn: d', 'error: e']);
  });

  it('trace seviyesinde her sey gecer', () => {
    const { lines, sink } = collector();
    const log = createLogger('trace', sink);
    log.trace('x');
    log.error('y');
    expect(lines).toHaveLength(2);
  });

  it('silent hicbir sey yazmaz', () => {
    const { lines, sink } = collector();
    const log = createLogger('silent', sink);
    log.error('kritik');
    expect(lines).toEqual([]);
  });

  it('child ad oneki ekler ve ic ice birikir', () => {
    const { lines, sink } = collector();
    const log = createLogger('info', sink).child('render').child('babylon');
    log.info('hazir');
    expect(lines).toEqual(['info: [render][babylon] hazir']);
  });

  it('child ayni esigi devralir', () => {
    const { lines, sink } = collector();
    const log = createLogger('error', sink).child('x');
    log.info('gorunmez');
    log.error('gorunur');
    expect(lines).toEqual(['error: [x] gorunur']);
  });

  it('seviyeyi disari verir', () => {
    const levels: LogLevel[] = ['trace', 'info', 'silent'];
    for (const level of levels) {
      expect(createLogger(level, () => undefined).level).toBe(level);
    }
  });
});
