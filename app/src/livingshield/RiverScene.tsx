import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  calculateBankLayout,
  DEFAULT_BANK,
  moduleSlots,
  type BankInputs,
  type InstallationStage,
  type UiTheme,
} from './model';

interface SceneValues {
  input: BankInputs;
  stage: InstallationStage;
  theme: UiTheme;
  rotate: boolean;
  reset: number;
}

function disposeObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child instanceof THREE.InstancedMesh) child.dispose();
      geometries.add(child.geometry);
      for (const material of Array.isArray(child.material) ? child.material : [child.material])
        materials.add(material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function moduleLodGeometry() {
  const points = [
    new THREE.Vector3(-0.15, 0, 0.0866),
    new THREE.Vector3(0.15, 0, 0.0866),
    new THREE.Vector3(0, 0, -0.1732),
    new THREE.Vector3(0, 0.3, 0),
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 0],
    [0, 3],
    [1, 3],
    [2, 3],
  ];
  const parts = edges.map(([a, b]) => {
    const direction = points[b].clone().sub(points[a]);
    const geometry = new THREE.CylinderGeometry(0.014, 0.014, direction.length(), 6);
    geometry.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize(),
      ),
    );
    geometry.translate(...points[a].clone().add(points[b]).multiplyScalar(0.5).toArray());
    return geometry;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return merged;
}

function createEngine(
  host: HTMLDivElement,
  mode: 'module' | 'bank',
  status: (value: string) => void,
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute(
    'aria-label',
    mode === 'module'
      ? 'LivingShield source module in 3D. Drag to orbit; scroll or pinch to zoom.'
      : 'Conceptual bank installation in 3D. Drag to orbit; scroll or pinch to zoom.',
  );
  renderer.domElement.tabIndex = 0;
  renderer.domElement.dataset.sceneMode = mode;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.autoRotateSpeed = 0.6;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.listenToKeyEvents(renderer.domElement);
  const ambient = new THREE.HemisphereLight(0xedf5f0, 0x697361, 2.1);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xfff0d7, 3.5);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const shadowSpan = mode === 'module' ? 0.7 : 8;
  key.shadow.camera.left = key.shadow.camera.bottom = -shadowSpan;
  key.shadow.camera.right = key.shadow.camera.top = shadowSpan;
  key.shadow.normalBias = 0.02;
  key.shadow.bias = -0.0001;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb9d8e4, 1.7);
  fill.position.set(-4, 3, -3);
  scene.add(fill);
  const content = new THREE.Group();
  scene.add(content);
  let values: SceneValues = {
    input: DEFAULT_BANK,
    stage: 'existing',
    theme: 'accessible',
    rotate: false,
    reset: 0,
  };
  let layoutKey = '';
  let geometryKey = '';
  let hasCamera = false;
  let module: THREE.Group | null = null;
  let disposed = false;
  let visible = true;
  let frame = 0;
  let previousTime = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();

  function render(time = 0) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    if (controls.autoRotate)
      controls.update(previousTime ? Math.min((time - previousTime) / 1000, 0.1) : 0);
    previousTime = time;
    renderer.render(scene, camera);
    renderer.domElement.dataset.renderedTriangles = String(renderer.info.render.triangles);
    renderer.domElement.dataset.camera = JSON.stringify({
      position: camera.position.toArray(),
      target: controls.target.toArray(),
    });
    if (controls.autoRotate) requestRender();
  }
  function requestRender() {
    if (!disposed && !frame) frame = requestAnimationFrame(render);
  }
  function fitCamera() {
    const box = new THREE.Box3().setFromObject(mode === 'module' && module ? module : content);
    if (box.isEmpty()) return;
    const centre = box.getCenter(new THREE.Vector3());
    const direction =
      mode === 'module' ? new THREE.Vector3(0.7, 0.48, 0.8) : new THREE.Vector3(0.55, 0.55, 0.9);
    direction.normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanHorizontal = tanVertical * camera.aspect;
    let distance = 0;
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const offset = new THREE.Vector3(x, y, z).sub(centre);
          const depth = offset.dot(direction);
          distance = Math.max(
            distance,
            depth + Math.abs(offset.dot(right)) / tanHorizontal,
            depth + Math.abs(offset.dot(up)) / tanVertical,
          );
        }
      }
    }
    distance *= mode === 'module' ? 1.2 : 1.12;
    controls.target.copy(centre);
    camera.position.copy(centre).add(direction.multiplyScalar(distance));
    controls.minDistance = mode === 'module' ? 0.35 : 1;
    controls.maxDistance = Math.max(distance * 5, 2);
    camera.near = Math.max(0.005, distance / 1000);
    camera.far = Math.max(100, distance * 20);
    camera.updateProjectionMatrix();
    controls.update();
    hasCamera = true;
  }
  function clearContent() {
    for (const child of [...content.children]) {
      content.remove(child);
      disposeObject(child);
    }
  }
  function buildBank() {
    clearContent();
    const { input, stage } = values;
    const layout = calculateBankLayout(input);
    const width = Math.max(input.lengthM + 1.8, 4.4);
    const toeY = 0.08;
    const points = [
      new THREE.Vector2(-layout.horizontalRunM - 1, input.heightM + toeY),
      new THREE.Vector2(-layout.horizontalRunM, input.heightM + toeY),
      new THREE.Vector2(0, toeY),
      new THREE.Vector2(1, -0.12),
      new THREE.Vector2(1, -0.48),
      new THREE.Vector2(-layout.horizontalRunM - 1, -0.48),
    ];
    const shape = new THREE.Shape(points);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: false,
      steps: 1,
    });
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(width / 2, 0, 0);
    const bank = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: 0x8b806b, roughness: 0.97 }),
    );
    bank.castShadow = bank.receiveShadow = true;
    content.add(bank);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.5, 1.9),
      new THREE.MeshStandardMaterial({
        color: 0x45787b,
        roughness: 0.23,
        metalness: 0.18,
        transparent: true,
        opacity: 0.88,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.01, 1.0);
    content.add(water);
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 1),
      new THREE.MeshStandardMaterial({ color: 0x6c8258, roughness: 1, side: THREE.DoubleSide }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, input.heightM + toeY + 0.002, -layout.horizontalRunM - 0.5);
    content.add(grass);
    if (stage !== 'existing') {
      const slots = moduleSlots(input);
      const units = new THREE.InstancedMesh(
        moduleLodGeometry(),
        new THREE.MeshStandardMaterial({ color: 0xc3c6bc, roughness: 0.82 }),
        slots.length,
      );
      const transform = new THREE.Object3D();
      slots.forEach((slot, index) => {
        transform.position.set(
          slot.x,
          toeY + Math.sin(layout.slopeRadians) * slot.upSlope + 0.015,
          -Math.cos(layout.slopeRadians) * slot.upSlope,
        );
        transform.quaternion.setFromEuler(new THREE.Euler(layout.slopeRadians, 0, 0));
        transform.rotateY(slot.rotation);
        transform.updateMatrix();
        units.setMatrixAt(index, transform.matrix);
      });
      units.castShadow = units.receiveShadow = true;
      units.instanceMatrix.needsUpdate = true;
      content.add(units);
      if (stage === 'established') {
        const count = Math.min(600, slots.length);
        const plants = new THREE.InstancedMesh(
          new THREE.ConeGeometry(0.06, 0.32, 5),
          new THREE.MeshStandardMaterial({ color: 0x547450, roughness: 0.95 }),
          count,
        );
        for (let i = 0; i < count; i++) {
          const slot = slots[Math.floor((i * slots.length) / count)];
          transform.position.set(
            slot.x,
            toeY + Math.sin(layout.slopeRadians) * slot.upSlope + 0.25,
            -Math.cos(layout.slopeRadians) * slot.upSlope,
          );
          transform.rotation.set(0, i * 2.4, Math.sin(i * 1.7) * 0.12);
          transform.scale.set(0.7 + (i % 4) * 0.14, 0.75 + (i % 5) * 0.12, 0.8);
          transform.updateMatrix();
          plants.setMatrixAt(i, transform.matrix);
        }
        plants.instanceMatrix.needsUpdate = true;
        content.add(plants);
      }
    }
    content.userData = {
      installedModules: stage === 'existing' ? 0 : layout.installedModules,
      stage,
      mode,
    };
    renderer.domElement.dataset.installationStage = stage;
    renderer.domElement.dataset.renderedModules = String(
      stage === 'existing' ? 0 : layout.installedModules,
    );
    if (!hasCamera) fitCamera();
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const changedAspect = Math.abs(camera.aspect - width / height) > 0.001;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (!hasCamera || changedAspect) fitCamera();
    requestRender();
  }
  function update(next: SceneValues) {
    if (disposed) return;
    const reset = next.reset !== values.reset;
    values = next;
    scene.background = new THREE.Color(
      next.theme === 'accessible' ? 0xe2e8de : next.theme === 'dark' ? 0x102426 : 0x050b0a,
    );
    controls.autoRotate = next.rotate && !reduced.matches;
    const nextKey = JSON.stringify([
      next.input.lengthM,
      next.input.heightM,
      next.input.slopeDegrees,
      next.stage,
    ]);
    if (mode === 'bank' && nextKey !== layoutKey) {
      layoutKey = nextKey;
      const nextGeometryKey = JSON.stringify([
        next.input.lengthM,
        next.input.heightM,
        next.input.slopeDegrees,
      ]);
      if (nextGeometryKey !== geometryKey) hasCamera = false;
      geometryKey = nextGeometryKey;
      buildBank();
      status('ready');
    }
    if (reset) fitCamera();
    requestRender();
  }
  controls.addEventListener('change', requestRender);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    previousTime = 0;
    requestRender();
  });
  visibility.observe(host);
  const onVisibility = () => {
    previousTime = 0;
    requestRender();
  };
  const onMotion = () => {
    controls.autoRotate = values.rotate && !reduced.matches;
    requestRender();
  };
  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onMotion);
  if (mode === 'module') {
    fetch('/livingshield/module_triangle.glb', { signal: abort.signal })
      .then((response) => {
        if (!response.ok) throw new Error('The source module asset could not be loaded.');
        return response.arrayBuffer();
      })
      .then((buffer) => new GLTFLoader().parseAsync(buffer, '/livingshield/'))
      .then((gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        module = gltf.scene;
        renderer.domElement.dataset.sourceAsset = '/livingshield/module_triangle.glb';
        module.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            for (const material of Array.isArray(child.material)
              ? child.material
              : [child.material])
              material.dispose();
            child.material = new THREE.MeshStandardMaterial({
              color: 0xbec2b8,
              roughness: 0.78,
              metalness: 0.01,
            });
            child.castShadow = child.receiveShadow = true;
          }
        });
        const box = new THREE.Box3().setFromObject(module);
        module.position.y -= box.min.y;
        content.add(module);
        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(0.32, 80),
          new THREE.MeshStandardMaterial({ color: 0x819583, roughness: 1, side: THREE.DoubleSide }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.002;
        ground.receiveShadow = true;
        content.add(ground);
        fitCamera();
        resize();
        status('ready');
      })
      .catch((error: unknown) => {
        if (!disposed)
          status(error instanceof Error ? error.message : 'The 3D source module is unavailable.');
      });
  }
  resize();
  return {
    update,
    dispose() {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotion);
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      clearContent();
      key.shadow.map?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

export default function RiverScene({
  mode,
  input,
  stage,
  theme,
}: {
  mode: 'module' | 'bank';
  input: BankInputs;
  stage: InstallationStage;
  theme: UiTheme;
}) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<ReturnType<typeof createEngine> | null>(null);
  const [status, setStatus] = useState('loading');
  const [reset, setReset] = useState(0);
  const [rotate, setRotate] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!host.current) return;
    try {
      engine.current = createEngine(host.current, mode, setStatus);
    } catch {
      queueMicrotask(() =>
        setStatus(
          '3D rendering is unavailable. The design files and installation film remain available below.',
        ),
      );
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [mode, revision]);
  useEffect(() => {
    engine.current?.update({ input, stage, theme, reset, rotate });
  }, [input, stage, theme, reset, rotate, revision, mode]);
  return (
    <div className="ls-scene-wrap">
      <div ref={host} className="ls-canvas" />
      {status !== 'ready' && (
        <div className="ls-scene-status" role={status === 'loading' ? 'status' : 'alert'}>
          {status === 'loading' ? (
            'Opening the source design…'
          ) : (
            <>
              {status}
              <button
                onClick={() => {
                  setStatus('loading');
                  setRevision((n) => n + 1);
                }}
              >
                Retry 3D
              </button>
            </>
          )}
        </div>
      )}
      <div className="ls-scene-tools">
        <span>
          {mode === 'module' ? 'SOURCE GLB · METRE SCALE' : 'CONCEPT LAYOUT · SIMPLIFIED GEOMETRY'}
        </span>
        <button onClick={() => setReset((n) => n + 1)}>Reset view</button>
        {mode === 'module' && (
          <button aria-pressed={rotate} onClick={() => setRotate((value) => !value)}>
            {rotate ? 'Pause rotation' : 'Rotate module'}
          </button>
        )}
      </div>
      <p className="ls-scene-help">Drag to orbit · scroll or pinch to zoom</p>
    </div>
  );
}
