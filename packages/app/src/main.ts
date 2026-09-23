/**
 * Uygulama giris noktasi.
 *
 * Katmanlari birbirine baglar ve kare dongusunu surer. Oyun kurali icermez:
 * kurallar `core-sim`'de, gorsellestirme `core-present`'te, tarayici islerı
 * `engine`'dedir.
 */
import { ViewBuilder, StatsTracker, TICK_MS, TransformRing, formatStats } from '@bfme/core-present';
import { type SimState, createSimState, formatStateHash, hashState, tick } from '@bfme/core-sim';
import {
  DEFAULT_CAMERA_CONFIG,
  DEFAULT_SCENE_CONFIG,
  type CameraState,
  type Logger,
  attachInput,
  createCameraState,
  createCanvasRenderer,
  createLogger,
  createOverlay,
  updateCamera,
} from '@bfme/engine';
import { formatIssues, loadContent, memorySource } from '@bfme/modloader';
import type { Content } from '@bfme/schema';
import { files as initialFiles } from 'virtual:bfme-content';
import { type AppConfig, readConfig } from './config';
import { FixedTimestep } from './loop';
import { DEFAULT_SCENARIO, Scenario } from './scenario';

/** İcerik yeniden yuklendiginde bildirimin ekranda kalma suresi. */
const NOTICE_MS = 2500;

function requireCanvas(): HTMLCanvasElement {
  const element = document.querySelector('canvas');
  if (element === null) {
    throw new Error('index.html icinde <canvas> bulunamadi.');
  }
  return element;
}

/** İcerigi yukler; basarisizsa hatalari ekrana ve gunluge yazar. */
function loadOrReport(
  files: Record<string, string>,
  config: AppConfig,
  log: Logger,
): Content | undefined {
  const result = loadContent(memorySource(files), { enabled: [...config.enabledMods] });
  if (result.ok) return result.content;
  log.error(`İcerik yuklenemedi:\n${formatIssues(result.issues)}`);
  return undefined;
}

function start(): void {
  const config = readConfig();
  const log = createLogger(config.logLevel).child('app');

  if (config.tickRate !== Math.round(1000 / TICK_MS)) {
    log.warn(
      `VITE_BFME_TICK_RATE=${String(config.tickRate)} sim'in TICK_RATE sabitinden farkli. ` +
        'Sim tick basina adimini kendi sabitinden turetir, bu yuzden birimler daha hizli ' +
        'veya yavas gorunur. Bu ayar yalnizca gelistirme icindir.',
    );
  }

  const canvas = requireCanvas();
  const parent = canvas.parentElement ?? document.body;

  const renderer = createCanvasRenderer(canvas, DEFAULT_SCENE_CONFIG);
  const input = attachInput(canvas);
  const overlay = createOverlay(parent);
  const stats = new StatsTracker();
  const ring = new TransformRing();
  const view = new ViewBuilder();
  const timestep = new FixedTimestep(1000 / config.tickRate);

  let camera: CameraState = createCameraState(DEFAULT_CAMERA_CONFIG);
  let content = loadOrReport(initialFiles, config, log);
  let simState: SimState = createSimState();
  let scenario =
    content === undefined
      ? undefined
      : new Scenario(content, {
          ...DEFAULT_SCENARIO,
          seed: config.seed,
        });
  let noticeUntilMs = 0;
  let notice = '';

  /**
   * Sim'i sifirdan baslatir.
   *
   * İcerik degistiginde CALISAN sim'in icerigi degistirilmez: determinizm
   * bunu kaldirmaz. Bunun yerine her sey ayni tohumla bastan kurulur.
   */
  function restart(next: Content, reason: string, nowMs: number): void {
    content = next;
    simState = createSimState();
    scenario = new Scenario(next, { ...DEFAULT_SCENARIO, seed: config.seed });
    ring.reset();
    timestep.reset();
    stats.reset();
    notice = reason;
    noticeUntilMs = nowMs + NOTICE_MS;
    log.info(`${reason} — sim tohum ${String(config.seed)} ile yeniden baslatildi.`);
  }

  function step(): void {
    if (content === undefined || scenario === undefined) return;
    tick(simState, scenario.next(simState), content);
    ring.capture(simState);
    stats.recordTick();
    if (config.simTrace) {
      log.trace(`tick ${String(simState.tick)} hash ${formatStateHash(hashState(simState))}`);
    }
  }

  let lastMs = performance.now();

  function frame(nowMs: number): void {
    const delta = nowMs - lastMs;
    lastMs = nowMs;

    const sample = input.sample();
    camera = updateCamera(
      camera,
      {
        panRight: sample.pan.right,
        panForward: sample.pan.forward,
        zoomSteps: sample.zoomSteps,
        dt: delta / 1000,
      },
      DEFAULT_CAMERA_CONFIG,
    );

    timestep.advance(delta, step);

    if (content !== undefined) {
      renderer.setBatches(view.build(ring, content, timestep.alpha));
    }
    renderer.render(camera);

    stats.recordFrame(nowMs);
    if (config.showStats && content !== undefined) {
      const lines = formatStats(stats.sample(simState, content));
      if (nowMs < noticeUntilMs) lines.push('', notice);
      overlay.setLines(lines);
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => {
    renderer.resize();
  });

  if (config.hotReload && import.meta.hot) {
    import.meta.hot.on('bfme:content', (data: { files: Record<string, string> }) => {
      const next = loadOrReport(data.files, config, log);
      if (next !== undefined) restart(next, 'İcerik yeniden yuklendi', performance.now());
    });
  }

  log.info(
    content === undefined
      ? 'İcerik yuklenemedi; sahne bos calisiyor.'
      : `İcerik yuklendi: ${String(content.unitTypes.length)} birim tipi, ` +
          `${String(content.factions.length)} fraksiyon.`,
  );

  requestAnimationFrame(frame);
}

start();
