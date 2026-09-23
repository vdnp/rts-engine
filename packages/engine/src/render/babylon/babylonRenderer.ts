/**
 * Babylon.js render uygulamasi.
 *
 * `@babylonjs/*` importlari DEPODA YALNIZCA bu dizin altinda olabilir; ESLint
 * bunu zorlar. Disari cikan tek sey `Renderer` arayuzudur, dolayisiyla render
 * kutuphanesi degistiginde baska hicbir paket etkilenmez.
 *
 * Importlar agac budanabilir olsun diye tek tek modullerden yapilir; barrel
 * (`babylonjs`) kullanilmaz.
 */
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Engine } from '@babylonjs/core/Engines/engine';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Scene } from '@babylonjs/core/scene';
// Yan etki: Mesh'e thinInstance* yontemlerini ekler.
import '@babylonjs/core/Meshes/thinInstanceMesh';

import { type CameraState, cameraPosition } from '../../camera';
import {
  DEFAULT_SCENE_CONFIG,
  type InstanceBatch,
  MATRIX_STRIDE,
  type Renderer,
  type SceneConfig,
} from '../renderer';

function toColor3(rgb: readonly [number, number, number]): Color3 {
  return new Color3(rgb[0], rgb[1], rgb[2]);
}

/**
 * Verilen Babylon motoru uzerinde bir sahne kurar.
 *
 * Motor disaridan verilir; boylece testler `NullEngine` gecerek sahneyi GPU
 * olmadan kurabilir ve dogrulayabilir.
 */
export function createBabylonRenderer(
  engine: AbstractEngine,
  config: SceneConfig = DEFAULT_SCENE_CONFIG,
): Renderer {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(
    config.backgroundColor[0],
    config.backgroundColor[1],
    config.backgroundColor[2],
    1,
  );

  const camera = new TargetCamera('camera', new Vector3(0, 40, -40), scene);
  camera.setTarget(Vector3.Zero());
  scene.activeCamera = camera;

  const light = new HemisphericLight('light', new Vector3(0.4, 1, 0.2), scene);
  light.intensity = 0.95;

  const groundMaterial = new StandardMaterial('ground', scene);
  groundMaterial.diffuseColor = toColor3(config.groundColor);
  groundMaterial.specularColor = Color3.Black();

  const ground = CreateGround(
    'ground',
    { width: config.groundSize, height: config.groundSize },
    scene,
  );
  ground.material = groundMaterial;

  const prototype = CreateBox('box', { size: config.boxSize }, scene);
  prototype.setEnabled(false);
  prototype.isPickable = false;

  /** Kume basina bir mesh; her mesh kendi rengini ve matris tamponunu tutar. */
  const meshes: Mesh[] = [];
  const materials: StandardMaterial[] = [];

  function meshFor(index: number): Mesh {
    const existing = meshes[index];
    if (existing !== undefined) return existing;

    const material = new StandardMaterial(`batch${String(index)}`, scene);
    material.specularColor = Color3.Black();
    materials[index] = material;

    const mesh = prototype.clone(`batch${String(index)}`);
    // `clone` GEOMETRIYI PAYLASTIRIR. Thin instance matris tamponu geometrinin
    // uzerinde yasadigi icin, paylasilan geometride son yazan kume digerlerinin
    // tamponunu eziyordu: ekranda yalnizca tek bir kumenin konumlari cikiyordu.
    mesh.makeGeometryUnique();
    mesh.material = material;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.setEnabled(true);
    meshes[index] = mesh;
    return mesh;
  }

  return {
    setBatches(batches) {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        if (batch === undefined) continue;
        applyBatch(meshFor(i), materials, i, batch);
      }
      // Bu kare kullanilmayan mesh'ler gizlenir; bir sonraki karede geri gelir.
      for (let i = batches.length; i < meshes.length; i++) {
        meshes[i]?.setEnabled(false);
      }
    },

    render(state: CameraState) {
      const position = cameraPosition(state);
      camera.position.set(position.x, position.y, position.z);
      camera.setTarget(new Vector3(state.targetX, 0, state.targetZ));
      scene.render();
    },

    resize() {
      engine.resize();
    },

    dispose() {
      scene.dispose();
    },
  };
}

function applyBatch(
  mesh: Mesh,
  materials: StandardMaterial[],
  index: number,
  batch: InstanceBatch,
): void {
  const material = materials[index];
  if (material !== undefined) {
    material.diffuseColor = toColor3(batch.color);
  }

  if (batch.count <= 0) {
    mesh.setEnabled(false);
    return;
  }

  const needed = batch.count * MATRIX_STRIDE;
  // Tampon fazladan uzun olabilir; Babylon'a yalnizca kullanilan kismi ver.
  const view =
    batch.matrices.length === needed ? batch.matrices : batch.matrices.subarray(0, needed);

  mesh.setEnabled(true);
  mesh.thinInstanceSetBuffer('matrix', view, MATRIX_STRIDE, false);
  mesh.thinInstanceCount = batch.count;
}

/**
 * Bir tuval uzerinde WebGL motoru kurar ve sahneyi baslatir.
 * Tarayici giris noktasi budur.
 */
export function createCanvasRenderer(
  canvas: HTMLCanvasElement,
  config: SceneConfig = DEFAULT_SCENE_CONFIG,
): Renderer {
  const engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false });
  const renderer = createBabylonRenderer(engine, config);
  return {
    ...renderer,
    dispose() {
      renderer.dispose();
      engine.dispose();
    },
  };
}
