import { Fx, idiv } from '@bfme/sim-math';
import { describe, expect, it } from 'vitest';
import { applyCommands, type Command } from '../src/commands';
import { TICK_RATE } from '../src/constants';
import { entitySlot } from '../src/entity';
import { createSimState, isAlive, readI32, readU8, spawn } from '../src/state';
import { healthSystem } from '../src/systems/health';
import { movementSystem, shortestTurn, turnToward } from '../src/systems/movement';
import { DEFAULT_UNITS, makeContent, w } from './support';

const content = makeContent();
const WALKER = 0;
const RUNNER = 1;
const STATUE = 2;

/** walker: 6 birim/saniye -> tick basina 13107 ham birim (0.2 birim). */
const WALKER_STEP = idiv(Fx.of(6), TICK_RATE);

function stateWith(unitType: number, posX = 0, posY = 0, facing = 0) {
  const state = createSimState(16);
  const entity = spawn(state, {
    unitType,
    owner: 0,
    posX,
    posY,
    facing,
    maxHealth: DEFAULT_UNITS[unitType]?.maxHealth ?? 100,
  });
  return { state, entity, slot: entitySlot(entity) };
}

function moveTo(entity: number, targetX: number, targetY: number): Command[] {
  return [{ kind: 'moveOrder', entity: entity as never, targetX, targetY }];
}

describe('aci yardimcilari', () => {
  it('shortestTurn kisa yonu secer', () => {
    expect(shortestTurn(0, 100)).toBe(100);
    expect(shortestTurn(100, 0)).toBe(-100);
    // 359 dereceden 1 dereceye: 2 derece ileri, 358 derece geri degil
    expect(shortestTurn(65000, 100)).toBe(636);
    expect(shortestTurn(100, 65000)).toBe(-636);
    expect(shortestTurn(0, 0)).toBe(0);
  });

  it('shortestTurn sonucu [-32768, 32768) araliginda kalir', () => {
    for (let a = 0; a < 65536; a += 97) {
      for (let b = 0; b < 65536; b += 1013) {
        const d = shortestTurn(a, b);
        expect(d).toBeGreaterThanOrEqual(-32768);
        expect(d).toBeLessThan(32768);
      }
    }
  });

  it('turnToward adimi sinirlar', () => {
    expect(turnToward(0, 1000, 100)).toBe(100);
    expect(turnToward(0, 50, 100)).toBe(50);
    expect(turnToward(1000, 0, 100)).toBe(900);
    expect(turnToward(0, 40000, 100)).toBe(65436);
  });

  it('turnToward tur sinirinda sarar', () => {
    expect(turnToward(65500, 100, 200)).toBe(100);
    expect(turnToward(65500, 500, 200)).toBe(164);
  });
});

describe('movementSystem', () => {
  it('hedefe dogru tick basina bir adim ilerler', () => {
    const { state, entity, slot } = stateWith(WALKER);
    applyCommands(state, moveTo(entity, w(10), 0), content);

    movementSystem(state, content);
    expect(readI32(state.posX, slot)).toBe(WALKER_STEP);
    expect(readI32(state.posY, slot)).toBe(0);
    expect(readI32(state.velX, slot)).toBe(WALKER_STEP);

    // Fx.div eksi sonsuza yuvarladigi icin her adim en fazla 1 ham birim
    // (1/65536 dunya birimi) kaybeder. Kayip birikir ama sinirlidir ve
    // varlik sonunda hedefe TAM olarak oturur.
    movementSystem(state, content);
    const afterTwo = readI32(state.posX, slot);
    expect(afterTwo).toBeGreaterThan(WALKER_STEP);
    expect(WALKER_STEP * 2 - afterTwo).toBeLessThanOrEqual(2);
  });

  it('adim basina kayip 1 ham birimi asmaz', () => {
    const { state, entity, slot } = stateWith(WALKER);
    applyCommands(state, moveTo(entity, w(100), 0), content);
    let previous = 0;
    for (let i = 0; i < 100; i++) {
      movementSystem(state, content);
      const current = readI32(state.posX, slot);
      const advanced = current - previous;
      expect(advanced).toBeGreaterThanOrEqual(WALKER_STEP - 1);
      expect(advanced).toBeLessThanOrEqual(WALKER_STEP);
      previous = current;
    }
  });

  it('hedefe TAM olarak oturur ve durur', () => {
    const { state, entity, slot } = stateWith(WALKER);
    applyCommands(state, moveTo(entity, w(10), 0), content);

    for (let i = 0; i < 200; i++) movementSystem(state, content);

    expect(readI32(state.posX, slot)).toBe(w(10));
    expect(readI32(state.posY, slot)).toBe(0);
    expect(readU8(state.moving, slot)).toBe(0);
    expect(readI32(state.velX, slot)).toBe(0);
    expect(readI32(state.velY, slot)).toBe(0);
  });

  it('durduktan sonra bir daha kimildamaz', () => {
    const { state, entity, slot } = stateWith(WALKER);
    applyCommands(state, moveTo(entity, w(3), w(4)), content);
    for (let i = 0; i < 200; i++) movementSystem(state, content);
    const settled = readI32(state.posX, slot);
    for (let i = 0; i < 50; i++) movementSystem(state, content);
    expect(readI32(state.posX, slot)).toBe(settled);
  });

  it('kosegen harekette toplam hiz korunur', () => {
    const { state, entity, slot } = stateWith(WALKER);
    applyCommands(state, moveTo(entity, w(100), w(100)), content);
    movementSystem(state, content);

    const vx = readI32(state.velX, slot);
    const vy = readI32(state.velY, slot);
    const speed = Math.hypot(vx, vy);
    // tek tick'lik adim buyuklugu, yuvarlama payi disinda korunmali
    expect(Math.abs(speed - WALKER_STEP)).toBeLessThanOrEqual(2);
  });

  it('hizli birim daha cok yol alir', () => {
    const walker = stateWith(WALKER);
    const runner = stateWith(RUNNER);
    applyCommands(walker.state, moveTo(walker.entity, w(50), 0), content);
    applyCommands(runner.state, moveTo(runner.entity, w(50), 0), content);
    movementSystem(walker.state, content);
    movementSystem(runner.state, content);

    expect(readI32(runner.state.posX, runner.slot)).toBeGreaterThan(
      readI32(walker.state.posX, walker.slot),
    );
  });

  it('hizi sifir olan birim yerinden oynamaz ama emri tuketir', () => {
    const { state, entity, slot } = stateWith(STATUE);
    applyCommands(state, moveTo(entity, w(10), 0), content);
    movementSystem(state, content);
    // adim sifir oldugu icin hedefe "varmis" sayilir ve durur
    expect(readU8(state.moving, slot)).toBe(0);
    expect(readI32(state.posX, slot)).toBe(w(10));
  });

  it('emri olmayan varlik kimildamaz', () => {
    const { state, slot } = stateWith(WALKER, w(5), w(5));
    for (let i = 0; i < 10; i++) movementSystem(state, content);
    expect(readI32(state.posX, slot)).toBe(w(5));
    expect(readI32(state.posY, slot)).toBe(w(5));
  });

  it('olu varlik islenmez', () => {
    const { state, entity, slot } = stateWith(WALKER);
    applyCommands(state, moveTo(entity, w(10), 0), content);
    state.alive[slot] = 0;
    movementSystem(state, content);
    expect(readI32(state.posX, slot)).toBe(0);
  });

  it('tanimsiz birim tipinde hareketi durdurur, varligi oldurmez', () => {
    const { state, entity, slot } = stateWith(WALKER);
    applyCommands(state, moveTo(entity, w(10), 0), content);
    state.unitType[slot] = 99;
    movementSystem(state, content);
    expect(readU8(state.moving, slot)).toBe(0);
    expect(isAlive(state, entity)).toBe(true);
  });
});

describe('movementSystem — yon', () => {
  /** walker: 360 derece/saniye -> tick basina 2184 BAM. */
  const WALKER_TURN = idiv(Math.round((360 * 65536) / 360), TICK_RATE);

  it('hareket yonune doner', () => {
    const { state, entity, slot } = stateWith(WALKER);
    applyCommands(state, moveTo(entity, 0, w(10)), content);

    movementSystem(state, content);
    expect(readI32(state.facing, slot)).toBe(WALKER_TURN);

    // 90 derece = 16384 BAM; adim basina 2184 -> 8 tick
    for (let i = 0; i < 7; i++) movementSystem(state, content);
    expect(readI32(state.facing, slot)).toBe(16384);
  });

  it('donus hizi asilamaz', () => {
    const { state, entity, slot } = stateWith(WALKER);
    applyCommands(state, moveTo(entity, w(-10), 0), content);
    movementSystem(state, content);
    // 180 derecelik hedefe tek tick'te donemez
    expect(Math.abs(shortestTurn(0, readI32(state.facing, slot)))).toBeLessThanOrEqual(WALKER_TURN);
  });

  it('dogu yonunde yon degismez', () => {
    const { state, entity, slot } = stateWith(WALKER);
    applyCommands(state, moveTo(entity, w(10), 0), content);
    movementSystem(state, content);
    expect(readI32(state.facing, slot)).toBe(0);
  });

  it('yon her zaman [0, 65536) araliginda kalir', () => {
    const { state, entity, slot } = stateWith(WALKER, 0, 0, 65000);
    applyCommands(state, moveTo(entity, w(-5), w(-5)), content);
    for (let i = 0; i < 100; i++) {
      movementSystem(state, content);
      const facing = readI32(state.facing, slot);
      expect(facing).toBeGreaterThanOrEqual(0);
      expect(facing).toBeLessThan(65536);
    }
  });
});

describe('healthSystem', () => {
  it('sagligi ust sinira kirpar', () => {
    const { state, slot } = stateWith(WALKER);
    state.health[slot] = 999;
    healthSystem(state);
    expect(readI32(state.health, slot)).toBe(100);
  });

  it('sagligi sifira dusen varligi yok eder', () => {
    const { state, entity, slot } = stateWith(WALKER);
    state.health[slot] = 0;
    healthSystem(state);
    expect(isAlive(state, entity)).toBe(false);
    expect(state.entityCount).toBe(0);
  });

  it('negatif saglikta da yok eder', () => {
    const { state, entity, slot } = stateWith(WALKER);
    state.health[slot] = -50;
    healthSystem(state);
    expect(isAlive(state, entity)).toBe(false);
  });

  it('saglikli varliga dokunmaz', () => {
    const { state, entity, slot } = stateWith(WALKER);
    state.health[slot] = 42;
    healthSystem(state);
    expect(isAlive(state, entity)).toBe(true);
    expect(readI32(state.health, slot)).toBe(42);
  });

  it('bosalan slot yeniden kullanilabilir', () => {
    const { state, slot } = stateWith(WALKER);
    state.health[slot] = 0;
    healthSystem(state);
    const next = spawn(state, {
      unitType: WALKER,
      owner: 0,
      posX: 0,
      posY: 0,
      facing: 0,
      maxHealth: 100,
    });
    expect(entitySlot(next)).toBe(slot);
  });
});
