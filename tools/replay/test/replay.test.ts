import { createSimState } from '@bfme/core-sim';
import { memorySource } from '@bfme/modloader';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { nodeSource, walkContent } from '../src/nodeSource';
import { ReplayError, loadOrThrow, runReplay } from '../src/run';
import { Scenario } from '../src/scenario';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const contentDir = path.join(repoRoot, 'content');

const base = (ticks: number, seed = 42) => ({
  seed,
  ticks,
  mods: ['base'],
  source: nodeSource(contentDir),
});

describe('nodeSource', () => {
  it('icerik dizinini gezer ve yalnizca TOML toplar', () => {
    const files = walkContent(contentDir);
    expect(files).toContain('base/manifest.toml');
    expect(files.every((file) => file.endsWith('.toml'))).toBe(true);
  });

  it('yollari sirali verir', () => {
    const files = walkContent(contentDir);
    expect([...files].sort()).toEqual(files);
  });

  it('dosya okur, olmayanda tanimsiz doner', () => {
    const source = nodeSource(contentDir);
    expect(source.read('base/manifest.toml')).toContain('id = "base"');
    expect(source.read('yok/olmayan.toml')).toBeUndefined();
  });

  it('dosya listesi kurulusta sabitlenir', () => {
    const source = nodeSource(contentDir);
    expect(source.list()).toBe(source.list());
  });
});

describe('runReplay — determinizm', () => {
  it('ayni secenekler ayni sonucu verir', () => {
    expect(runReplay(base(500))).toEqual(runReplay(base(500)));
  });

  it('10 kez ust uste ayni hash', () => {
    const first = runReplay(base(200)).finalStateHash;
    for (let i = 0; i < 9; i++) {
      expect(runReplay(base(200)).finalStateHash).toBe(first);
    }
  });

  it('farkli tohum farkli son durum verir', () => {
    expect(runReplay(base(500, 1)).finalStateHash).not.toBe(runReplay(base(500, 2)).finalStateHash);
  });

  it('farkli tick sayisi farkli son durum verir', () => {
    expect(runReplay(base(100)).finalStateHash).not.toBe(runReplay(base(101)).finalStateHash);
  });

  it('tohum icerik hash-ini etkilemez', () => {
    expect(runReplay(base(50, 1)).dataHash).toBe(runReplay(base(50, 999)).dataHash);
  });

  it('sifir tick bos bir durum verir', () => {
    const result = runReplay(base(0));
    expect(result.ticks).toBe(0);
    expect(result.entityCount).toBe(0);
  });
});

describe('runReplay — ara hash-ler', () => {
  it('istenen aralikta kaydeder', () => {
    const result = runReplay({ ...base(100), checkpointEvery: 25 });
    expect(result.checkpoints.map((c) => c.tick)).toEqual([25, 50, 75, 100]);
    for (const checkpoint of result.checkpoints) {
      expect(checkpoint.hash).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it('kapaliyken bos liste verir', () => {
    expect(runReplay(base(100)).checkpoints).toEqual([]);
  });

  it('ara hash-ler de deterministik', () => {
    const a = runReplay({ ...base(300), checkpointEvery: 50 });
    const b = runReplay({ ...base(300), checkpointEvery: 50 });
    expect(a.checkpoints).toEqual(b.checkpoints);
  });

  it('ara hash almak son sonucu degistirmez', () => {
    expect(runReplay({ ...base(300), checkpointEvery: 10 }).finalStateHash).toBe(
      runReplay(base(300)).finalStateHash,
    );
  });
});

describe('runReplay — hatalar', () => {
  it('negatif tick sayisini reddeder', () => {
    expect(() => runReplay(base(-1))).toThrow(ReplayError);
    expect(() => runReplay({ ...base(0), ticks: 1.5 })).toThrow(ReplayError);
  });

  it('olmayan mod icin okunabilir hata verir', () => {
    expect(() => runReplay({ ...base(10), mods: ['yok'] })).toThrow(ReplayError);
    expect(() => runReplay({ ...base(10), mods: ['yok'] })).toThrow(/yuklenemedi/);
  });

  it('bozuk icerikte hatalari raporlar', () => {
    const source = memorySource({
      'base/manifest.toml': 'id = "base"\nname = "x"\nversion = "1.0.0"\n',
      'base/u.toml': '[unit.bozuk]\nname = ""\nmaxHealth = -1\n',
    });
    expect(() => loadOrThrow(source, ['base'])).toThrow(/maxHealth/);
  });
});

describe('runReplay — davranis', () => {
  it('birim doguruyor ve sinirda duruyor', () => {
    expect(runReplay(base(50)).entityCount).toBeGreaterThan(0);
    expect(runReplay(base(5000)).entityCount).toBe(256);
  });

  it('icerik hash-i yukleyicininkiyle ayni', () => {
    const content = loadOrThrow(nodeSource(contentDir), ['base']);
    expect(runReplay(base(1)).dataHash).toBe(
      (content.dataHash >>> 0).toString(16).padStart(8, '0'),
    );
  });
});

describe('Scenario', () => {
  it('reset akisi bastan uretir', () => {
    const content = loadOrThrow(nodeSource(contentDir), ['base']);
    const scenario = new Scenario(content, 7);
    const state = createSimState(8);
    const first = scenario.next(state);
    scenario.reset();
    expect(scenario.next(state)).toEqual(first);
  });

  it('bos icerikte komut uretmez', () => {
    const content = loadOrThrow(nodeSource(contentDir), ['base']);
    const empty = { ...content, unitTypes: [] };
    const scenario = new Scenario(empty, 1);
    expect(scenario.next(createSimState(8))).toEqual([]);
  });
});
