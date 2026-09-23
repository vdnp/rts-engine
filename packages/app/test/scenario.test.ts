import { createSimState, tick } from '@bfme/core-sim';
import { type ContentSource, loadContent, memorySource } from '@bfme/modloader';
import type { Content } from '@bfme/schema';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENARIO, Scenario } from '../src/scenario';

/** Iki fraksiyonlu, iki birimli kucuk bir icerik. */
function testContent(): Content {
  const files: Record<string, string> = {
    'base/manifest.toml': 'id = "base"\nname = "Test"\nversion = "1.0.0"\n',
    'base/f.toml': [
      '[faction.alpha]',
      'name = "Alfa"',
      'color = [255, 0, 0]',
      'units = ["walker"]',
      '',
      '[faction.beta]',
      'name = "Beta"',
      'color = [0, 0, 255]',
      'units = ["runner"]',
      '',
    ].join('\n'),
    'base/u.toml': [
      '[unit.walker]',
      'name = "Yuruyen"',
      'maxHealth = 100',
      'speed = 6.0',
      'turnRate = 360.0',
      'radius = 0.5',
      '',
      '[unit.runner]',
      'name = "Kosan"',
      'maxHealth = 60',
      'speed = 12.0',
      'turnRate = 720.0',
      'radius = 0.4',
      '',
    ].join('\n'),
  };
  const source: ContentSource = memorySource(files);
  const result = loadContent(source, { enabled: ['base'] });
  if (!result.ok) throw new Error(result.issues.map((i) => i.message).join('\n'));
  return result.content;
}

const content = testContent();
const config = { ...DEFAULT_SCENARIO, seed: 7 };

/** Senaryoyu N tick kosar ve uretilen komutlarin ozetini dondurur. */
function run(seed: number, ticks: number): string[] {
  const state = createSimState(128);
  const scenario = new Scenario(content, { ...DEFAULT_SCENARIO, seed });
  const log: string[] = [];
  for (let t = 0; t < ticks; t++) {
    const commands = scenario.next(state);
    for (const command of commands) {
      log.push(
        command.kind === 'spawnUnit'
          ? `s ${String(command.unitType)} ${String(command.posX)} ${String(command.posY)}`
          : `m ${String(command.entity)} ${String(command.targetX)} ${String(command.targetY)}`,
      );
    }
    tick(state, commands, content);
  }
  return log;
}

describe('Scenario — determinizm', () => {
  it('ayni tohum ayni komut akisini verir', () => {
    expect(run(7, 200)).toEqual(run(7, 200));
  });

  it('farkli tohum farkli akis verir', () => {
    expect(run(1, 200)).not.toEqual(run(2, 200));
  });

  it('reset akisi bastan uretir', () => {
    const state = createSimState(128);
    const scenario = new Scenario(content, config);
    const first = scenario.next(state);
    scenario.reset();
    expect(scenario.next(state)).toEqual(first);
  });
});

describe('Scenario — davranis', () => {
  it('birim dogurur', () => {
    const state = createSimState(128);
    const scenario = new Scenario(content, config);
    for (let t = 0; t < 60; t++) tick(state, scenario.next(state), content);
    expect(state.entityCount).toBeGreaterThan(0);
  });

  it('varlik sinirini asmaz', () => {
    const state = createSimState(256);
    const scenario = new Scenario(content, { ...config, maxEntities: 8 });
    for (let t = 0; t < 500; t++) tick(state, scenario.next(state), content);
    expect(state.entityCount).toBeLessThanOrEqual(8);
  });

  it('birimleri hareket ettirir', () => {
    const state = createSimState(128);
    const scenario = new Scenario(content, config);
    for (let t = 0; t < 30; t++) tick(state, scenario.next(state), content);
    const before = state.posX[0];
    for (let t = 0; t < 120; t++) tick(state, scenario.next(state), content);
    expect(state.posX[0]).not.toBe(before);
  });

  it('konumlar harita sinirlari icinde kalir', () => {
    const state = createSimState(256);
    const scenario = new Scenario(content, config);
    const limit = DEFAULT_SCENARIO.mapExtent * 65536;
    for (let t = 0; t < 600; t++) {
      tick(state, scenario.next(state), content);
      for (let slot = 0; slot < state.highWater; slot++) {
        if (state.alive[slot] !== 1) continue;
        expect(Math.abs(state.posX[slot] ?? 0)).toBeLessThanOrEqual(limit);
        expect(Math.abs(state.posY[slot] ?? 0)).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('birimin sahibi kendi fraksiyonudur', () => {
    const state = createSimState(128);
    const scenario = new Scenario(content, config);
    for (let t = 0; t < 200; t++) tick(state, scenario.next(state), content);
    for (let slot = 0; slot < state.highWater; slot++) {
      if (state.alive[slot] !== 1) continue;
      const type = content.unitTypes[state.unitType[slot] ?? 0];
      expect(state.owner[slot]).toBe(type?.faction);
    }
  });

  it('bos icerikte komut uretmez', () => {
    const empty: Content = { ...content, unitTypes: [] };
    const scenario = new Scenario(empty, config);
    expect(scenario.next(createSimState(8))).toEqual([]);
  });
});
