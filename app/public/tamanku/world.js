/* HydroGrid local adaptation of TamanKu, hongchenzhijin/TamanKu commit a78aa4d0f2caf558c473935c24e5b48ca11bdb4b.
   Original software licence was not supplied; see THIRD_PARTY.md.
   TamanKu 3D world: builds Taman Kelisa Emas from OpenStreetMap data with three.js.
   Frame: x = metres east, y = up, z = metres south. */
(function () {
  const TK = (window.TK = window.TK || {});
  const D = window.KELISA_MAP;
  const bounds = D.bounds;
  const viewSize = Math.max(bounds[1] - bounds[0], bounds[3] - bounds[2]);
  const groundLayers = [];
  const featureMeshes = [];
  let selectedFeatureId = null;
  let selectionLines = [];
  let proposalFrameStart = null;
  let aerialTexture = null;
  let aerialRequest = 0;
  let viewportObserver = null;
  let terrainGrid = null;
  let terrainSignature = null;
  let terrainMinimumM = 0;
  let terrainMaximumM = 0;
  let buildingHeightScale = 1;
  let floodMesh = null;
  let floodPosition = null;
  let floodColor = null;
  let floodStats = { wetCells: 0, maxDepthM: 0, timeSeconds: 0, mode: 'before', visible: false };
  const W = (TK.world = {});

  // ------------------------------------------------------------ helpers
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = rng(20261014);
  const pick = (arr, r = R) => arr[Math.floor(r() * arr.length)];
  function pip(x, z, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi) c = !c;
    }
    return c;
  }
  function segProj(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0;
    const x = ax + t * dx, z = az + t * dz;
    return { t, x, z, d: Math.hypot(px - x, pz - z) };
  }
  W.pip = pip;
  W.rng = rng;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  class GeoBuf {
    constructor() { this.pos = []; this.uv = []; this.idx = []; }
    v(x, y, z, u = 0, w = 0) { this.pos.push(x, y, z); this.uv.push(u, w); return this.pos.length / 3 - 1; }
    tri(a, b, c) { this.idx.push(a, b, c); }
    segment(ax, az, bx, bz, hw, y) {
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
      if (L < 1e-3) return;
      const nx = (-dz / L) * hw, nz = (dx / L) * hw;
      const a = this.v(ax + nx, y, az + nz), b = this.v(ax - nx, y, az - nz);
      const c = this.v(bx + nx, y, bz + nz), d = this.v(bx - nx, y, bz - nz);
      this.tri(a, c, b); this.tri(b, c, d);
    }
    disc(x, z, r, y, n = 10) {
      const c = this.v(x, y, z);
      const first = this.pos.length / 3;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; this.v(x + Math.cos(a) * r, y, z + Math.sin(a) * r); }
      for (let i = 0; i < n; i++) this.tri(c, first + ((i + 1) % n), first + i);
    }
    polyline(pts, w, y, caps = true) {
      const hw = w / 2;
      for (let i = 0; i < pts.length - 1; i++) this.segment(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], hw, y);
      if (caps) for (let i = 0; i < pts.length; i++) this.disc(pts[i][0], pts[i][1], hw, y, hw > 3 ? 12 : 8);
    }
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
      const n = new Float32Array(this.pos.length);
      for (let i = 1; i < n.length; i += 3) n[i] = 1;
      g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
      g.setIndex(this.idx);
      return g;
    }
  }

  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = 4;
    return t;
  }

  // ------------------------------------------------------------ state
  let renderer, scene, camera, controls, sun, hemi;
  const clock = new THREE.Clock();
  const frameFns = [];
  const groups = {};
  const nightMats = [];   // {mat, day, night} for emissive tweaks
  let nightT = 0, nightTarget = 0;
  let lampPoints, boundaryWall, groundMesh;
  let unitMesh, roofMesh, panelMesh, unitBaseColors, unitTops = [];
  const units = D.units.map((u, i) => ({ i, x: u[0], z: u[1], w: u[2], d: u[3], rot: u[4], lv: u[5], gen: u[6], h: Math.max(5.6, u[5] * 3.1) }));
  W.units = units;
  const kelisa = D.boundary;
  units.forEach((u) => { u.inside = pip(u.x, u.z, kelisa); });
  W.solarSet = new Set();

  let uiTheme = "accessible";
  const SKY_DAY = new THREE.Color(0xdce5dc), SKY_NIGHT = new THREE.Color(0x0a1626);
  const GROUND_DAY = new THREE.Color(0xd3dfbf), GROUND_NIGHT = new THREE.Color(0x26342c);

  // ------------------------------------------------------------ init
  W.init = function (canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.clippingPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -bounds[0]),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), bounds[1]),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -bounds[2]),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), bounds[3]),
    ];
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.background = SKY_DAY.clone();
    scene.fog = new THREE.Fog(SKY_DAY.clone(), viewSize * 3, viewSize * 7);

    camera = new THREE.PerspectiveCamera(36, 1, 3, Math.max(6000, viewSize * 8));
    camera.position.set(viewSize * 0.35, viewSize * 0.62, viewSize * 0.58);
    controls = new THREE.MapControls(camera, renderer.domElement);
    controls.listenToKeyEvents(renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = false;
    controls.minDistance = 45;
    controls.maxDistance = viewSize * 2.2;
    controls.maxPolarAngle = 1.22;
    controls.zoomSpeed = 1.1;
    controls.update();

    hemi = new THREE.HemisphereLight(0xe9f5ff, 0x7d8b62, 0.62);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff0d8, 0.72);
    sun.position.set(-320, 560, 300);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = bounds[0] - 100; sc.right = bounds[1] + 100; sc.top = bounds[3] + 100; sc.bottom = bounds[2] - 100; sc.near = 10; sc.far = viewSize * 3;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.6;
    scene.add(sun);
    scene.add(sun.target);

    buildGround();
    const groundLayerStart = scene.children.length;
    buildAreas();
    buildRoads();
    buildWater();
    groundLayers.push(...scene.children.slice(groundLayerStart));
    buildBuildings();
    buildUnits();
    buildOccupancy();
    if (D.boundary.length > 2) buildBoundary();
    W.glowTex = glowTexture();
    lampPoints = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
    lampPoints.visible = false;
    scene.add(lampPoints);
    W.addToScene();

    W.resize();
    W.fitView(true);
    window.addEventListener("resize", W.resize);
    if (window.ResizeObserver) {
      viewportObserver = new ResizeObserver(W.resize);
      viewportObserver.observe(canvas.parentElement);
    }
    renderer.setAnimationLoop(loop);
  };

  W.resize = function () {
    const c = renderer.domElement;
    const w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (fly) stepFly(dt);
    controls.update();
    clampTarget();
    if (nightT !== nightTarget) {
      nightT += Math.sign(nightTarget - nightT) * dt / 1.2;
      nightT = Math.max(0, Math.min(1, nightT));
      if (Math.abs(nightT - nightTarget) < 0.001) nightT = nightTarget;
      applyNight(nightT);
    }
    for (const f of frameFns) f(dt, t);
    renderer.render(scene, camera);
  }
  W.onFrame = (f) => frameFns.push(f);

  function clampTarget() {
    const tg = controls.target;
    const cx = Math.max(bounds[0], Math.min(bounds[1], tg.x)), cz = Math.max(bounds[2], Math.min(bounds[3], tg.z));
    if (cx !== tg.x || cz !== tg.z) {
      const dx = cx - tg.x, dz = cz - tg.z;
      tg.x = cx; tg.z = cz; camera.position.x += dx; camera.position.z += dz;
    }
  }

  // ------------------------------------------------------------ ground & areas
  function buildGround() {
    const g = new THREE.PlaneGeometry(bounds[1] - bounds[0], bounds[3] - bounds[2]);
    g.rotateX(-Math.PI / 2);
    groundMesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: GROUND_DAY.clone() }));
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    W.ground = groundMesh;
  }

  function validGrid(grid) {
    if (!grid || !Number.isInteger(grid.cols) || !Number.isInteger(grid.rows) || grid.cols < 2 || grid.rows < 2 || grid.cols > 128 || grid.rows > 128) throw new Error('Terrain requires a 2–128 cell grid');
    if (![grid.dxM, grid.dzM].every((value) => Number.isFinite(value) && value > 0 && value <= 1000) || ![grid.originX, grid.originZ].every(Number.isFinite)) throw new Error('Terrain requires finite grid dimensions');
    if (Math.abs(grid.originX - bounds[0]) > 1 || Math.abs(grid.originZ - bounds[2]) > 1 || Math.abs(grid.cols * grid.dxM - (bounds[1] - bounds[0])) > 1 || Math.abs(grid.rows * grid.dzM - (bounds[3] - bounds[2])) > 1) throw new Error('Terrain must cover the selected township study window');
    if (!Array.isArray(grid.elevationsM) || grid.elevationsM.length !== grid.cols * grid.rows || !grid.elevationsM.every((value) => Number.isFinite(value) && value >= -500 && value <= 9000)) throw new Error('Terrain elevations are missing or invalid');
  }

  function gridElevation(x, z) {
    if (!terrainGrid) return 0;
    const g = terrainGrid;
    const col = Math.max(0, Math.min(g.cols - 1, (x - g.originX) / g.dxM - 0.5));
    const row = Math.max(0, Math.min(g.rows - 1, (z - g.originZ) / g.dzM - 0.5));
    const left = Math.floor(col), top = Math.floor(row), right = Math.min(g.cols - 1, left + 1), bottom = Math.min(g.rows - 1, top + 1);
    const fx = col - left, fz = row - top;
    const north = g.elevationsM[top * g.cols + left] * (1 - fx) + g.elevationsM[top * g.cols + right] * fx;
    const south = g.elevationsM[bottom * g.cols + left] * (1 - fx) + g.elevationsM[bottom * g.cols + right] * fx;
    return north * (1 - fz) + south * fz - terrainMinimumM;
  }

  function cellVertices(col, row) {
    const g = terrainGrid;
    const x0 = g.originX + col * g.dxM, z0 = g.originZ + row * g.dzM, x1 = x0 + g.dxM, z1 = z0 + g.dzM;
    return [[x0, gridElevation(x0, z0), z0], [x1, gridElevation(x1, z0), z0], [x1, gridElevation(x1, z1), z1], [x0, gridElevation(x0, z1), z1], [(x0 + x1) / 2, g.elevationsM[row * g.cols + col] - terrainMinimumM, (z0 + z1) / 2]];
  }

  function terrainHeight(x, z) {
    if (!terrainGrid) return 0;
    const g = terrainGrid;
    const col = Math.max(0, Math.min(g.cols - 1, Math.floor((x - g.originX) / g.dxM)));
    const row = Math.max(0, Math.min(g.rows - 1, Math.floor((z - g.originZ) / g.dzM)));
    const points = cellVertices(col, row);
    for (let i = 0; i < 4; i++) {
      const a = points[i], b = points[(i + 1) % 4], c = points[4];
      const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
      const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
      if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) return u * a[1] + v * b[1] + (1 - u - v) * c[1];
    }
    return gridElevation(x, z);
  }
  W.terrainHeight = terrainHeight;

  function drapeGeometry(mesh) {
    const original = mesh.userData.flatGeometry || mesh.geometry;
    if (!mesh.userData.flatGeometry) mesh.userData.flatGeometry = original;
    const source = original.index ? original.toNonIndexed() : original;
    const positions = source.getAttribute('position'), uv = source.getAttribute('uv');
    const result = [], texture = [];
    const maxEdge = Math.min(terrainGrid.dxM, terrainGrid.dzM) * 0.65;
    const middle = (a, b) => a.map((value, i) => (value + b[i]) / 2);
    function triangle(a, b, c, depth) {
      const lengths = [[a, b], [b, c], [c, a]].map(([p, q]) => Math.hypot(p[0] - q[0], p[2] - q[2]));
      const edge = lengths.indexOf(Math.max(...lengths));
      if (lengths[edge] > maxEdge && depth < 12 && result.length < 900000) {
        if (edge === 0) { const m = middle(a, b); triangle(a, m, c, depth + 1); triangle(m, b, c, depth + 1); }
        else if (edge === 1) { const m = middle(b, c); triangle(a, b, m, depth + 1); triangle(a, m, c, depth + 1); }
        else { const m = middle(c, a); triangle(a, b, m, depth + 1); triangle(m, b, c, depth + 1); }
      } else [a, b, c].forEach((p) => { result.push(p[0], p[1] + terrainHeight(p[0], p[2]), p[2]); texture.push(p[3], p[4]); });
    }
    for (let i = 0; i < positions.count; i += 3) {
      const vertex = (j) => [positions.getX(j), positions.getY(j), positions.getZ(j), uv ? uv.getX(j) : 0, uv ? uv.getY(j) : 0];
      triangle(vertex(i), vertex(i + 1), vertex(i + 2), 0);
    }
    if (source !== original) source.dispose();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(result, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(texture, 2));
    geometry.computeVertexNormals();
    if (mesh.geometry !== original) mesh.geometry.dispose();
    mesh.geometry = geometry;
  }

  function placeBuildings() {
    groups.buildings.children.forEach((mesh) => {
      const building = mesh.userData.building;
      if (!building) return;
      const points = building.p;
      const cx = points.reduce((sum, point) => sum + point[0], 0) / points.length;
      const cz = points.reduce((sum, point) => sum + point[1], 0) / points.length;
      if (mesh.userData.originalBaseY === undefined) mesh.userData.originalBaseY = mesh.position.y;
      mesh.position.y = terrainHeight(cx, cz) + mesh.userData.originalBaseY * buildingHeightScale;
      mesh.scale.y = buildingHeightScale;
    });
    groups.buildings.scale.y = 1;
  }

  W.setTerrain = function (grid) {
    validGrid(grid);
    const signature = JSON.stringify([grid.cols, grid.rows, grid.dxM, grid.dzM, grid.originX, grid.originZ, grid.elevationsM]);
    if (signature === terrainSignature) return false;
    terrainSignature = signature;
    terrainGrid = { ...grid, elevationsM: [...grid.elevationsM] };
    terrainMinimumM = Math.min(...grid.elevationsM);
    terrainMaximumM = Math.max(...grid.elevationsM);
    W.clearFlood();
    const geometry = new THREE.BufferGeometry(), positions = [], texture = [], indices = [];
    for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
      const points = cellVertices(col, row), offset = positions.length / 3;
      points.forEach((p) => { positions.push(...p); texture.push((p[0] - bounds[0]) / (bounds[1] - bounds[0]), 1 - (p[2] - bounds[2]) / (bounds[3] - bounds[2])); });
      for (let edge = 0; edge < 4; edge++) indices.push(offset + edge, offset + 4, offset + ((edge + 1) % 4));
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(texture, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    groundMesh.geometry.dispose();
    groundMesh.geometry = geometry;
    groundLayers.forEach((object) => object.traverse((mesh) => { if (mesh.isMesh) drapeGeometry(mesh); }));
    placeBuildings();
    groups.meet.children.forEach((marker) => { marker.position.y = terrainHeight(marker.position.x, marker.position.z); });
    if (selectedFeatureId !== null) W.highlightFeature(selectedFeatureId);
    const targetY = terrainHeight(controls.target.x, controls.target.z);
    camera.position.y += targetY - controls.target.y;
    controls.target.y = targetY;
    return true;
  };

  const FLOOD_COLORS = [[0.05, 0xb1eced], [0.15, 0x77cedf], [0.3, 0x38acce], [0.6, 0x1780b6], [1, 0x235d9b], [2, 0x263f83], [Infinity, 0x382c68]].map(([depth, color]) => [depth, new THREE.Color(color)]);

  W.clearFlood = function () {
    if (floodMesh) { floodMesh.visible = false; floodMesh.geometry.setDrawRange(0, 0); }
    floodStats = { wetCells: 0, maxDepthM: 0, timeSeconds: 0, mode: 'before', visible: false };
  };

  W.setFloodFrame = function (frame) {
    if (!frame || frame.showWater === false) { W.clearFlood(); return; }
    if (!terrainGrid) throw new Error('Load terrain before displaying simulated flood depths');
    const count = terrainGrid.cols * terrainGrid.rows;
    if (frame.cols !== terrainGrid.cols || frame.rows !== terrainGrid.rows || !Array.isArray(frame.depthsM) || frame.depthsM.length !== count || !frame.depthsM.every((value) => Number.isFinite(value) && value >= 0 && value <= 100) || !Number.isFinite(frame.timeSeconds) || frame.timeSeconds < 0 || !['before', 'after'].includes(frame.mode)) throw new Error('The flood frame does not match the township terrain grid');
    const required = count * 24 * 3;
    if (!floodMesh || floodPosition.length !== required) {
      if (floodMesh) { scene.remove(floodMesh); floodMesh.geometry.dispose(); floodMesh.material.dispose(); }
      floodPosition = new Float32Array(required);
      floodColor = new Float32Array(required);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(floodPosition, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('color', new THREE.BufferAttribute(floodColor, 3).setUsage(THREE.DynamicDrawUsage));
      floodMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      floodMesh.frustumCulled = false;
      floodMesh.renderOrder = 2;
      scene.add(floodMesh);
    }
    let used = 0, wetCells = 0, maximum = 0;
    function draw(a, b, c, level, color) {
      const source = [a, b, c], clipped = [];
      for (let i = 0; i < 3; i++) {
        const p = source[i], q = source[(i + 1) % 3], insideP = p[1] < level, insideQ = q[1] < level;
        if (insideP) clipped.push(p);
        if (insideP !== insideQ) { const f = (level - p[1]) / (q[1] - p[1]); clipped.push([p[0] + f * (q[0] - p[0]), level, p[2] + f * (q[2] - p[2])]); }
      }
      for (let i = 1; i + 1 < clipped.length; i++) [clipped[0], clipped[i], clipped[i + 1]].forEach((p) => {
        floodPosition[used] = p[0]; floodColor[used++] = color.r;
        floodPosition[used] = level; floodColor[used++] = color.g;
        floodPosition[used] = p[2]; floodColor[used++] = color.b;
      });
    }
    for (let row = 0; row < terrainGrid.rows; row++) for (let col = 0; col < terrainGrid.cols; col++) {
      const index = row * terrainGrid.cols + col, depth = frame.depthsM[index];
      maximum = Math.max(maximum, depth);
      if (depth < 0.02) continue;
      wetCells += 1;
      const level = terrainGrid.elevationsM[index] - terrainMinimumM + depth;
      const color = FLOOD_COLORS.find(([threshold]) => depth <= threshold)[1];
      const points = cellVertices(col, row);
      for (let edge = 0; edge < 4; edge++) draw(points[edge], points[(edge + 1) % 4], points[4], level, color);
    }
    floodMesh.geometry.attributes.position.needsUpdate = true;
    floodMesh.geometry.attributes.color.needsUpdate = true;
    floodMesh.geometry.setDrawRange(0, used / 3);
    floodMesh.visible = true;
    floodStats = { wetCells, maxDepthM: maximum, timeSeconds: frame.timeSeconds, mode: frame.mode, visible: true };
  };

  const AREA = {
    wood: { c: 0x76b062, y: 0.05 }, park: { c: 0x93cc7a, y: 0.05 }, grass: { c: 0xb2d692, y: 0.04 },
    farm: { c: 0xa5c76d, y: 0.06, tex: "rows" }, pitch: { c: 0x72bd63, y: 0.08, tex: "pitch" },
    playground: { c: 0xf2c879, y: 0.09 }, pool: { c: 0x67cdef, y: 0.1 }, parking: { c: 0xbcc1c4, y: 0.07 },
    school: { c: 0xebe2bf, y: 0.03 }, hospital: { c: 0xe5e6e2, y: 0.03 }, commercial: { c: 0xe6dae6, y: 0.03 },
    industrial: { c: 0xd3d6d6, y: 0.03 }, religious: { c: 0xdfead2, y: 0.045 }, construction: { c: 0xdcc39f, y: 0.04 },
    water: { c: 0x5ea9d9, y: 0.11 },
  };
  function shapeFrom(p, holes) {
    const s = new THREE.Shape(p.map((q) => new THREE.Vector2(q[0], -q[1])));
    if (holes) holes.forEach((h) => s.holes.push(new THREE.Path(h.map((q) => new THREE.Vector2(q[0], -q[1])))));
    return s;
  }
  function buildAreas() {
    const rowsTex = canvasTex(64, 64, (g) => {
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64);
      g.fillStyle = "#c9dca8";
      for (let i = 0; i < 64; i += 16) g.fillRect(0, i, 64, 6);
      g.fillStyle = "#e7f0d9";
      for (let i = 8; i < 64; i += 16) g.fillRect(0, i + 2, 64, 3);
    }, true);
    rowsTex.repeat.set(1 / 7, 1 / 7);
    const pitchTex = canvasTex(64, 64, (g) => {
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64);
      g.fillStyle = "#e4f2dc"; g.fillRect(0, 0, 32, 64);
    }, true);
    pitchTex.repeat.set(1 / 10, 1 / 10);
    const mats = {};
    for (const a of D.areas) {
      const st = AREA[a.c];
      if (!st) continue;
      const key = a.c;
      if (!mats[key]) {
        mats[key] = a.c === "water" || a.c === "pool"
          ? new THREE.MeshPhongMaterial({ color: st.c, shininess: 90, specular: 0x9fd7ff })
          : new THREE.MeshLambertMaterial({ color: st.c, map: st.tex === "rows" ? rowsTex : st.tex === "pitch" ? pitchTex : null });
      }
      const geo = new THREE.ShapeGeometry(shapeFrom(a.p, a.h));
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mats[key]);
      m.position.y = st.y;
      m.userData.featureId = a.id;
      featureMeshes.push(m);
      m.receiveShadow = true;
      scene.add(m);
    }
  }

  // ------------------------------------------------------------ roads
  const ROAD_COL = {
    motorway: 0x585e66, motorway_link: 0x5e646b, secondary: 0x61676e, tertiary: 0x686e75, unclassified: 0x72787e,
    residential: 0x777d83, living_street: 0x7d8288, service: 0x8c9195, track: 0xb4a27c, footway: 0xd9cfb6, path: 0xd2c7aa, steps: 0xcfc4a6,
    pedestrian: 0xd9cfb6, cycleway: 0xc9d7b0,
  };
  function buildRoads() {
    const walk = new GeoBuf(), bufs = {}, dash = new GeoBuf();
    for (const r of D.roads) {
      const col = ROAD_COL[r.t] || 0x7a8085;
      (bufs[col] = bufs[col] || new GeoBuf()).polyline(r.p, r.w, r.t === "footway" || r.t === "path" ? 0.16 : 0.2);
      if (!["footway", "path", "steps", "track", "cycleway", "service"].includes(r.t)) walk.polyline(r.p, r.w + 3.2, 0.13);
      if (["secondary", "tertiary", "motorway", "unclassified"].includes(r.t)) {
        // dashed centre line
        let carry = 0;
        for (let i = 0; i < r.p.length - 1; i++) {
          const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1];
          const L = Math.hypot(bx - ax, bz - az);
          let s = carry;
          while (s < L) {
            const e = Math.min(L, s + 3);
            dash.segment(ax + (bx - ax) * (s / L), az + (bz - az) * (s / L), ax + (bx - ax) * (e / L), az + (bz - az) * (e / L), 0.12, 0.24);
            s += 9;
          }
          carry = s - L;
        }
      }
    }
    const walkMesh = new THREE.Mesh(walk.build(), new THREE.MeshLambertMaterial({ color: 0xdedbd2 }));
    walkMesh.receiveShadow = true;
    scene.add(walkMesh);
    for (const col in bufs) {
      const m = new THREE.Mesh(bufs[col].build(), new THREE.MeshLambertMaterial({ color: Number(col) }));
      m.receiveShadow = true;
      scene.add(m);
    }
    const dm = new THREE.Mesh(dash.build(), new THREE.MeshBasicMaterial({ color: 0xf4f1e6 }));
    scene.add(dm);
  }

  function buildWater() {
    const b = new GeoBuf(), bank = new GeoBuf();
    for (const w of D.water) {
      b.polyline(w.p, w.w, 0.18);
      bank.polyline(w.p, w.w + 4, 0.12);
    }
    const tex = canvasTex(64, 64, (g) => {
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64);
      g.strokeStyle = "rgba(160,215,255,.9)"; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(Math.random() * 64, Math.random() * 64); g.lineTo(Math.random() * 64, Math.random() * 64); g.stroke(); }
    }, true);
    const geo = b.build();
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 14, pos.getZ(i) / 14);
    const mat = new THREE.MeshPhongMaterial({ color: 0x4e9fd5, map: tex, shininess: 100, specular: 0xbfe6ff });
    scene.add(new THREE.Mesh(geo, mat));
    const bm = new THREE.Mesh(bank.build(), new THREE.MeshLambertMaterial({ color: 0x9cc58a }));
    bm.receiveShadow = true;
    scene.add(bm);
    W.onFrame((dt) => { tex.offset.x += dt * 0.03; tex.offset.y += dt * 0.012; });
  }

  // ------------------------------------------------------------ buildings
  function windowTextures() {
    const r = rng(7);
    const lit = [];
    for (let i = 0; i < 64; i++) lit.push(r() < 0.42 ? pick(["#ffd27c", "#ffe7b0", "#ffc566", "#fff1cf"], r) : null);
    const day = canvasTex(256, 256, (g) => {
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, 256, 256);
      for (let rr = 0; rr < 8; rr++) for (let c = 0; c < 8; c++) {
        const x = c * 32 + 8, y = rr * 32 + 10;
        g.fillStyle = "#7f95a6"; g.fillRect(x, y, 16, 14);
        g.fillStyle = "#c4d2dc"; g.fillRect(x, y, 16, 3);
        g.fillStyle = "#e9e6df"; g.fillRect(x - 2, y + 14, 20, 2);
      }
    }, true);
    const night = canvasTex(256, 256, (g) => {
      g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256);
      for (let rr = 0; rr < 8; rr++) for (let c = 0; c < 8; c++) {
        const col = lit[rr * 8 + c];
        if (col) { g.fillStyle = col; g.fillRect(c * 32 + 8, rr * 32 + 10, 16, 14); }
      }
    }, true);
    day.repeat.set(1 / (8 * 3.6), 1 / (8 * 3.3));
    night.repeat.copy(day.repeat);
    return { day, night };
  }

  const BCOL = {
    apartments: [0xe4e1d8], hospital: [0xe8e8e2], school: [0xe8e1d0], commercial: [0xdedfd9],
    retail: [0xdedfd9], industrial: [0xd0d4d5], mosque: [0xe9e6db], yes: [0xe8e4d9],
    house: [0xe8e4d9], bungalow: [0xe8e4d9], semidetached_house: [0xe8e4d9], terrace: [0xe8e4d9], roof: [0x8b959c],
  };
  const CAPCOL = { hospital: 0x7f8c95, school: 0x778b9c, commercial: 0x7b858d, retail: 0x7b858d,
    industrial: 0x8a959c, mosque: 0x848c8e, house: 0x7b8995, bungalow: 0x7b8995,
    semidetached_house: 0x7b8995, terrace: 0x7b8995, roof: 0x8b959c };

  function buildBuildings() {
    const tex = windowTextures();
    const wallMats = {}, capMats = {};
    W.buildings = [];
    groups.buildings = new THREE.Group();
    scene.add(groups.buildings);
    for (const b of D.buildings) {
      const kind = BCOL[b.k] ? b.k : "yes";
      const col = pick(BCOL[kind]);
      const key = kind + col;
      if (!wallMats[key]) {
        wallMats[key] = new THREE.MeshLambertMaterial({ color: col, map: kind === "roof" ? null : tex.day, emissiveMap: kind === "roof" ? null : tex.night, emissive: 0x000000 });
        if (kind !== "roof") nightMats.push({ mat: wallMats[key], prop: "emissive", day: new THREE.Color(0x000000), night: new THREE.Color(0xffffff) });
      }
      if (!capMats[kind]) capMats[kind] = new THREE.MeshLambertMaterial({ color: CAPCOL[kind] || 0x7e8b95 });
      const isRoof = kind === "roof";
      const h = Math.max(0.5, Number(b.heightMetres) || (isRoof ? 0.6 : b.l * 3.3));
      const geo = new THREE.ExtrudeGeometry(shapeFrom(b.p, b.h), { depth: h, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, [capMats[kind], wallMats[key]]);
      if (isRoof) m.position.y = 4.2;
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData = { building: b, featureId: b.id };
      featureMeshes.push(m);
      groups.buildings.add(m);
      const xs = b.p.map((q) => q[0]), zs = b.p.map((q) => q[1]);
      const cx = xs.reduce((a, v) => a + v, 0) / xs.length, cz = zs.reduce((a, v) => a + v, 0) / zs.length;
      W.buildings.push({ x: cx, z: cz, h, b });
      if (D.decorativeLandmarks && (b.k === "mosque" || b.am === "place_of_worship")) {
        const r = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * 0.32;
        const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0x2f8c5a, shininess: 60 }));
        dome.position.set(cx, h, cz);
        dome.castShadow = true;
        dome.userData.featureId = b.id;
        groups.buildings.add(dome);
        featureMeshes.push(dome);
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 8), new THREE.MeshLambertMaterial({ color: 0xe0b44a }));
        spire.position.set(cx, h + r + 1.2, cz);
        spire.userData.featureId = b.id;
        groups.buildings.add(spire);
        featureMeshes.push(spire);
      }
    }
  }

  // ------------------------------------------------------------ terrace houses (instanced)
  function facadeTextures() {
    const draw = (lit) => (g) => {
      g.fillStyle = lit ? "#000" : "#ffffff"; g.fillRect(0, 0, 128, 128);
      const win = (x, y, w, h, on) => {
        if (lit) { if (on) { g.fillStyle = "#ffd88c"; g.fillRect(x, y, w, h); } return; }
        g.fillStyle = "#7d93a3"; g.fillRect(x, y, w, h);
        g.fillStyle = "#c7d4dd"; g.fillRect(x, y, w, 3);
      };
      if (!lit) {
        g.fillStyle = "#e9e4da"; g.fillRect(0, 60, 128, 4);       // floor band
        g.fillStyle = "#cfc8bb"; g.fillRect(0, 118, 128, 10);     // porch tiles
        g.fillStyle = "#6e4a33"; g.fillRect(16, 74, 24, 44);      // door
        g.strokeStyle = "#5b6670"; g.lineWidth = 2;               // grille
        for (let x = 6; x < 128; x += 8) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x, 118); g.stroke(); }
      }
      win(14, 18, 40, 30, true); win(74, 18, 40, 30, false); win(58, 78, 54, 26, true);
    };
    return { day: canvasTex(128, 128, draw(false)), night: canvasTex(128, 128, draw(true)) };
  }
  function roofPrism() {
    const g = new THREE.BufferGeometry();
    const v = [
      -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, 0, -0.5, 0, -0.5, 0.5, 1, 0, -0.5, 1, 0,   // back slope
      -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, 0.5, 0, 0.5,     // front slope
      -0.5, 0, -0.5, -0.5, 1, 0, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 1, 0, // gables
    ];
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }
  const HOUSE_COLS = [0xf3ede2, 0xe6efe8, 0xf3e3d0, 0xdce8f0, 0xf5e4e6, 0xebe6f3, 0xf4efd6, 0xe9f1dc].map((c) => new THREE.Color(c));
  const ROOF_COLS = [0xb5523b, 0xa8462f, 0xc2643f, 0x8f3d2d, 0x9c5a3b, 0x6d7278, 0xb04a3a].map((c) => new THREE.Color(c));

  function buildUnits() {
    const n = units.length;
    const ft = facadeTextures();
    const plain = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const facade = new THREE.MeshLambertMaterial({ color: 0xffffff, map: ft.day, emissiveMap: ft.night, emissive: 0x000000 });
    nightMats.push({ mat: facade, prop: "emissive", day: new THREE.Color(0), night: new THREE.Color(0xffffff) });
    unitMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [plain, plain, plain, plain, facade, facade], n);
    roofMesh = new THREE.InstancedMesh(roofPrism(), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), n);
    unitMesh.castShadow = roofMesh.castShadow = true;
    unitMesh.receiveShadow = roofMesh.receiveShadow = true;
    const dmy = new THREE.Object3D();
    const r = rng(99);
    unitBaseColors = [];
    units.forEach((u, i) => {
      dmy.position.set(u.x, u.h / 2, u.z);
      dmy.rotation.set(0, -u.rot, 0);
      dmy.scale.set(u.w - 0.08, u.h, u.d);
      dmy.updateMatrix();
      unitMesh.setMatrixAt(i, dmy.matrix);
      const c = pick(HOUSE_COLS, r).clone();
      unitMesh.setColorAt(i, c);
      unitBaseColors.push(c);
      u.roofH = 2.1;
      dmy.position.set(u.x, u.h, u.z);
      dmy.scale.set(u.w + 0.02, u.roofH, u.d + 1.2);
      dmy.updateMatrix();
      roofMesh.setMatrixAt(i, dmy.matrix);
      const rc = pick(ROOF_COLS, r);
      roofMesh.setColorAt(i, rc);
      u.roofColor = rc;
      u.top = u.h + u.roofH;
    });
    if (unitMesh.instanceColor) unitMesh.instanceColor.needsUpdate = true;
    if (roofMesh.instanceColor) roofMesh.instanceColor.needsUpdate = true;
    scene.add(unitMesh, roofMesh);
    W.unitMesh = unitMesh;

    // --- solar panels on ~31% of taman homes + showcase homes
    const S = TK.SOLAR;
    const sr = rng(42);
    const inside = units.filter((u) => u.inside);
    inside.forEach((u) => { if (sr() < S.share) W.solarSet.add(u.i); });
    S.showcase.forEach((s) => { const u = W.nearestUnit(s.at[0], s.at[1]); W.solarSet.add(u.i); s.unit = u.i; });
    buildPanels();
  }

  function buildPanels() {
    if (panelMesh) { scene.remove(panelMesh); panelMesh.geometry.dispose(); }
    const list = [...W.solarSet];
    const cellTex = canvasTex(64, 64, (g) => {
      g.fillStyle = "#1c2f63"; g.fillRect(0, 0, 64, 64);
      g.strokeStyle = "#8fa6e0"; g.lineWidth = 1.2;
      for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
    });
    const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, map: cellTex, shininess: 120, specular: 0x9fb4ff, emissive: 0x000000 });
    panelMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, Math.max(1, list.length));
    panelMesh.count = list.length;
    const dmy = new THREE.Object3D();
    list.forEach((ui, k) => {
      const u = units[ui];
      const hd = (u.d + 1.2) / 2;
      const a = Math.atan2(u.roofH, hd);
      const s = Math.cos(u.rot) >= 0 ? 1 : -1;
      const lz = (s * hd) / 2;
      const ox = -lz * Math.sin(u.rot), oz = lz * Math.cos(u.rot);
      dmy.position.set(u.x + ox, u.h + u.roofH / 2 + 0.16, u.z + oz);
      dmy.rotation.set(s * a, -u.rot, 0, "YXZ");
      dmy.scale.set(u.w * 0.8, 0.14, Math.hypot(hd, u.roofH) * 0.72);
      dmy.updateMatrix();
      panelMesh.setMatrixAt(k, dmy.matrix);
    });
    panelMesh.castShadow = true;
    scene.add(panelMesh);
    W.panelMat = mat;
  }
  W.addSolar = function (ui) { W.solarSet.add(ui); buildPanels(); W.setLayerLook(currentLayer); };
  W.removeSolar = function (ui) { if (W.solarSet.delete(ui)) buildPanels(); };

  W.nearestUnit = function (x, z, filter) {
    let best = null, bd = 1e9;
    for (const u of units) {
      if (filter && !filter(u)) continue;
      const d = (u.x - x) ** 2 + (u.z - z) ** 2;
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  };

  // ------------------------------------------------------------ occupancy grid (keeps trees off roads/houses)
  const OG = { x0: bounds[0] - 40, z0: bounds[2] - 40, cs: 2, nx: 0, nz: 0, a: null };
  function buildOccupancy() {
    OG.nx = Math.ceil((bounds[1] - bounds[0] + 80) / OG.cs); OG.nz = Math.ceil((bounds[3] - bounds[2] + 80) / OG.cs);
    OG.a = new Uint8Array(OG.nx * OG.nz);
    const markSeg = (ax, az, bx, bz, r) => {
      const x0 = Math.floor((Math.min(ax, bx) - r - OG.x0) / OG.cs), x1 = Math.ceil((Math.max(ax, bx) + r - OG.x0) / OG.cs);
      const z0 = Math.floor((Math.min(az, bz) - r - OG.z0) / OG.cs), z1 = Math.ceil((Math.max(az, bz) + r - OG.z0) / OG.cs);
      for (let i = Math.max(0, x0); i <= Math.min(OG.nx - 1, x1); i++)
        for (let j = Math.max(0, z0); j <= Math.min(OG.nz - 1, z1); j++) {
          const p = segProj(OG.x0 + (i + 0.5) * OG.cs, OG.z0 + (j + 0.5) * OG.cs, ax, az, bx, bz);
          if (p.d < r) OG.a[j * OG.nx + i] = 1;
        }
    };
    const markPoly = (poly, val, pad = 0) => {
      const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
      const x0 = Math.floor((Math.min(...xs) - pad - OG.x0) / OG.cs), x1 = Math.ceil((Math.max(...xs) + pad - OG.x0) / OG.cs);
      const z0 = Math.floor((Math.min(...zs) - pad - OG.z0) / OG.cs), z1 = Math.ceil((Math.max(...zs) + pad - OG.z0) / OG.cs);
      for (let i = Math.max(0, x0); i <= Math.min(OG.nx - 1, x1); i++)
        for (let j = Math.max(0, z0); j <= Math.min(OG.nz - 1, z1); j++) {
          const x = OG.x0 + (i + 0.5) * OG.cs, z = OG.z0 + (j + 0.5) * OG.cs;
          if (pip(x, z, poly)) { const k = j * OG.nx + i; if (!OG.a[k] || val === 1) OG.a[k] = val; }
        }
    };
    for (const r of D.roads) for (let i = 0; i < r.p.length - 1; i++) markSeg(r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], r.w / 2 + 1.2);
    for (const w of D.water) for (let i = 0; i < w.p.length - 1; i++) markSeg(w.p[i][0], w.p[i][1], w.p[i + 1][0], w.p[i + 1][1], w.w / 2 + 1);
    for (const a of D.areas) if (["pitch", "pool", "parking", "playground", "water"].includes(a.c)) markPoly(a.p, 1);
    for (const b of D.buildings) markPoly(b.p, 1);
    for (const u of units) {
      const c = Math.cos(u.rot), s = Math.sin(u.rot);
      const hw = u.w / 2 + 1, hd = u.d / 2 + 1.5;
      const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [u.x + lx * c - lz * s, u.z + lx * s + lz * c]);
      markPoly(corners, 1);
    }
  }
  const free = (x, z) => {
    const i = Math.floor((x - OG.x0) / OG.cs), j = Math.floor((z - OG.z0) / OG.cs);
    if (i < 0 || j < 0 || i >= OG.nx || j >= OG.nz) return false;
    return OG.a[j * OG.nx + i] === 0;
  };
  W.isFree = free;

  // ------------------------------------------------------------ trees
  function buildTrees() {
    const r = rng(5);
    const trees = []; // [x, z, scale, type]
    const add = (x, z, type, s) => { if (free(x, z)) { trees.push([x, z, s, type]); const i = Math.floor((x - OG.x0) / OG.cs), j = Math.floor((z - OG.z0) / OG.cs); OG.a[j * OG.nx + i] = 3; } };
    // street trees
    for (const rd of D.roads) {
      if (!["residential", "tertiary", "secondary", "unclassified"].includes(rd.t)) continue;
      for (let i = 0; i < rd.p.length - 1; i++) {
        const [ax, az] = rd.p[i], [bx, bz] = rd.p[i + 1];
        const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
        for (let s = 6; s < L; s += 17) {
          for (const side of [1, -1]) {
            if (r() < 0.45) continue;
            const off = rd.w / 2 + 2.6;
            add(ax + ((bx - ax) * s) / L + nx * off * side, az + ((bz - az) * s) / L + nz * off * side, r() < 0.25 ? 1 : 0, 0.75 + r() * 0.35);
          }
        }
      }
    }
    // area trees
    const dens = { wood: 70, park: 160, grass: 380, religious: 300, school: 520, hospital: 420, farm: 1400, commercial: 900, construction: 1200, industrial: 900 };
    for (const a of D.areas) {
      const dd = dens[a.c];
      if (!dd) continue;
      const xs = a.p.map((p) => p[0]), zs = a.p.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      const nTry = Math.min(900, ((x1 - x0) * (z1 - z0)) / dd);
      for (let k = 0; k < nTry; k++) {
        const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
        if (pip(x, z, a.p)) add(x, z, a.c === "farm" ? 1 : r() < 0.15 ? 1 : 0, 0.8 + r() * 0.6);
      }
    }
    // scattered greenery on empty land and back gardens
    for (let k = 0; k < 2600; k++) {
      const x = -640 + r() * 1280, z = -480 + r() * 960;
      if (pip(x, z, kelisa) ? r() < 0.55 : r() < 0.2) add(x, z, r() < 0.35 ? 1 : 0, 0.7 + r() * 0.5);
    }
    W.treeCount = trees.length;
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1, 5);
    trunkGeo.translate(0, 0.5, 0);
    const crownGeo = new THREE.IcosahedronGeometry(1, 0);
    const palmGeo = new THREE.ConeGeometry(1, 0.7, 7);
    palmGeo.rotateX(Math.PI);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x7a5a3e }), trees.length);
    const round = trees.filter((t) => t[3] === 0), palms = trees.filter((t) => t[3] === 1);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), round.length);
    const fronds = new THREE.InstancedMesh(palmGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), palms.length);
    const dmy = new THREE.Object3D();
    const greens = [0x5f9f4a, 0x4e8f3e, 0x6bac53, 0x437f3a, 0x7bb65a, 0x5a9a56].map((c) => new THREE.Color(c));
    trees.forEach((t, i) => {
      const [x, z, s, ty] = t;
      const th = ty === 1 ? 9 * s : 3.2 * s;
      dmy.position.set(x, 0, z); dmy.rotation.set(0, 0, ty === 1 ? (r() - 0.5) * 0.15 : 0); dmy.scale.set(s * (ty ? 0.8 : 1), th, s * (ty ? 0.8 : 1)); dmy.updateMatrix();
      trunks.setMatrixAt(i, dmy.matrix);
    });
    round.forEach((t, i) => {
      const [x, z, s] = t;
      dmy.position.set(x, 3.2 * s + 2.2 * s, z); dmy.rotation.set(r() * 3, r() * 3, 0);
      const k = 2.6 * s + r() * 1.2; dmy.scale.set(k, k * 0.9, k); dmy.updateMatrix();
      crowns.setMatrixAt(i, dmy.matrix);
      crowns.setColorAt(i, pick(greens, r));
    });
    palms.forEach((t, i) => {
      const [x, z, s] = t;
      dmy.position.set(x, 9 * s + 0.6, z); dmy.rotation.set(0, r() * 3, 0); dmy.scale.set(3.4 * s, 2.2 * s, 3.4 * s); dmy.updateMatrix();
      fronds.setMatrixAt(i, dmy.matrix);
      fronds.setColorAt(i, pick(greens, r).clone().offsetHSL(0.02, 0, -0.05));
    });
    [trunks, crowns, fronds].forEach((m) => { m.castShadow = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; scene.add(m); });
  }

  // ------------------------------------------------------------ Kelisa Emas boundary "zone wall"
  function buildBoundary() {
    const grad = canvasTex(4, 64, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,1)");
      g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    });
    const pos = [], uv = [], idx = [];
    const p = kelisa;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const k = pos.length / 3;
      pos.push(a[0], 0, a[1], b[0], 0, b[1], b[0], 9, b[1], a[0], 9, a[1]);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    boundaryWall = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xf2b434, alphaMap: grad, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    boundaryWall.renderOrder = 2;
    scene.add(boundaryWall);
    const lb = new GeoBuf();
    lb.polyline(p.concat([p[0]]), 1.2, 0.3);
    scene.add(new THREE.Mesh(lb.build(), new THREE.MeshBasicMaterial({ color: 0xe9a520 })));
    W.onFrame((dt, t) => { boundaryWall.material.opacity = 0.38 + Math.sin(t * 1.6) * 0.12 + nightT * 0.2; });
  }

  // ------------------------------------------------------------ street lamps (visible at night)
  function glowTexture() {
    return canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,240,200,.75)"); gr.addColorStop(1, "rgba(255,200,120,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
  }
  W.glowTex = null;
  function buildLamps() {
    W.glowTex = glowTexture();
    const pts = [];
    for (const rd of D.roads) {
      if (["footway", "path", "steps", "track", "service"].includes(rd.t)) continue;
      for (let i = 0; i < rd.p.length - 1; i++) {
        const [ax, az] = rd.p[i], [bx, bz] = rd.p[i + 1];
        const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
        for (let s = 10; s < L; s += 28) pts.push(ax + ((bx - ax) * s) / L + nx * (rd.w / 2 + 0.8), 6, az + ((bz - az) * s) / L + nz * (rd.w / 2 + 0.8));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    lampPoints = new THREE.Points(g, new THREE.PointsMaterial({ size: 16, map: W.glowTex, color: 0xffc977, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    lampPoints.visible = false;
    scene.add(lampPoints);
  }

  // ------------------------------------------------------------ cars
  function buildCars() {
    const r = rng(11);
    const roads = D.roads.filter((rd) => ["motorway", "secondary", "tertiary", "unclassified", "residential"].includes(rd.t));
    const lenOf = (p) => { let L = 0; for (let i = 0; i < p.length - 1; i++) L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); return L; };
    const cand = roads.map((rd) => ({ rd, L: lenOf(rd.p) })).filter((c) => c.L > 70);
    const cars = [];
    const N = 46;
    for (let k = 0; k < N; k++) {
      const c = cand[Math.floor(r() * cand.length)];
      const cum = [0];
      for (let i = 0; i < c.rd.p.length - 1; i++) cum.push(cum[i] + Math.hypot(c.rd.p[i + 1][0] - c.rd.p[i][0], c.rd.p[i + 1][1] - c.rd.p[i][1]));
      const fast = c.rd.t === "motorway";
      cars.push({ p: c.rd.p, cum, L: c.L, s: r() * c.L, dir: r() < 0.5 ? 1 : -1, v: fast ? 22 + r() * 8 : c.rd.t === "residential" ? 5 + r() * 3 : 9 + r() * 5, lane: c.rd.w / 4 });
    }
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(4.3, 1.25, 1.9), new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
    const cab = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, 0.85, 1.72), new THREE.MeshLambertMaterial({ color: 0x2a3540 }), N);
    const cols = [0xf5f5f2, 0xc9ccd0, 0xd8433b, 0x22272c, 0x2f63b8, 0x8a9096, 0xe9eef2, 0x7e1f2b].map((c) => new THREE.Color(c));
    cars.forEach((c, i) => body.setColorAt(i, pick(cols, r)));
    body.instanceColor.needsUpdate = true;
    body.castShadow = cab.castShadow = true;
    scene.add(body, cab);
    const dmy = new THREE.Object3D(), off = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    W.onFrame((dt) => {
      cars.forEach((c, i) => {
        c.s += c.dir * c.v * dt;
        if (c.s > c.L) { c.s = c.L; c.dir = -1; } else if (c.s < 0) { c.s = 0; c.dir = 1; }
        let k = 1;
        while (k < c.cum.length - 1 && c.cum[k] < c.s) k++;
        const a = c.p[k - 1], b = c.p[k];
        const seg = c.cum[k] - c.cum[k - 1] || 1;
        const f = (c.s - c.cum[k - 1]) / seg;
        const dx = (b[0] - a[0]) / seg, dz = (b[1] - a[1]) / seg;
        const x = a[0] + (b[0] - a[0]) * f - dz * c.lane * c.dir, z = a[1] + (b[1] - a[1]) * f + dx * c.lane * c.dir;
        const ang = Math.atan2(dz * c.dir, dx * c.dir);
        dmy.position.set(x, 0.85, z); dmy.rotation.set(0, -ang, 0); dmy.scale.set(1, 1, 1); dmy.updateMatrix();
        body.setMatrixAt(i, dmy.matrix);
        off.set(-0.3, 1.0, 0).applyAxisAngle(UP, -ang);
        dmy.position.set(x + off.x, 0.85 + off.y, z + off.z); dmy.updateMatrix();
        cab.setMatrixAt(i, dmy.matrix);
      });
      body.instanceMatrix.needsUpdate = true;
      cab.instanceMatrix.needsUpdate = true;
    });
  }

  // ------------------------------------------------------------ road graph + routing
  const G = { nodes: new Map(), adj: [], xy: [], edges: [] };
  function nodeId(x, z) {
    const k = x + "," + z;
    let id = G.nodes.get(k);
    if (id === undefined) { id = G.xy.length; G.nodes.set(k, id); G.xy.push([x, z]); G.adj.push([]); }
    return id;
  }
  function buildGraph() {
    for (const r of D.roads) {
      if (["motorway", "motorway_link"].includes(r.t)) continue;
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = nodeId(r.p[i][0], r.p[i][1]), b = nodeId(r.p[i + 1][0], r.p[i + 1][1]);
        const L = Math.hypot(r.p[i + 1][0] - r.p[i][0], r.p[i + 1][1] - r.p[i][1]);
        G.adj[a].push([b, L]); G.adj[b].push([a, L]);
        G.edges.push([a, b, r]);
      }
    }
  }
  W.nearestRoad = function (x, z, filter) {
    let best = null;
    for (const [a, b, r] of G.edges) {
      if (filter && !filter(r)) continue;
      const A = G.xy[a], B = G.xy[b];
      const p = segProj(x, z, A[0], A[1], B[0], B[1]);
      if (!best || p.d < best.d) best = { ...p, a, b, road: r, dir: [B[0] - A[0], B[1] - A[1]] };
    }
    return best;
  };
  W.route = function (from, to) {
    const sA = W.nearestRoad(from[0], from[1]), sB = W.nearestRoad(to[0], to[1]);
    const n = G.xy.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    const heap = [];
    const push = (id, d) => { heap.push([d, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const dA = (id) => Math.hypot(G.xy[id][0] - sA.x, G.xy[id][1] - sA.z);
    for (const id of [sA.a, sA.b]) { dist[id] = dA(id); push(id, dist[id]); }
    while (heap.length) {
      const [d, u] = pop();
      if (done[u]) continue;
      done[u] = 1;
      for (const [v, w] of G.adj[u]) if (d + w < dist[v]) { dist[v] = d + w; prev[v] = u; push(v, dist[v]); }
    }
    const dB = (id) => Math.hypot(G.xy[id][0] - sB.x, G.xy[id][1] - sB.z);
    let end = dist[sB.a] + dB(sB.a) < dist[sB.b] + dB(sB.b) ? sB.a : sB.b;
    let pts = [], total = dist[end] + dB(end);
    const sameEdge = (sA.a === sB.a && sA.b === sB.b) || (sA.a === sB.b && sA.b === sB.a);
    if (sameEdge || !isFinite(total)) {
      pts = [[sA.x, sA.z], [sB.x, sB.z]];
      total = Math.hypot(sA.x - sB.x, sA.z - sB.z);
    } else {
      for (let v = end; v !== -1; v = prev[v]) pts.push(G.xy[v]);
      pts.reverse();
      pts.unshift([sA.x, sA.z]);
      pts.push([sB.x, sB.z]);
    }
    pts.unshift(from); pts.push(to);
    total += sA.d + sB.d;
    return { pts, length: total };
  };

  // ------------------------------------------------------------ route rendering
  let routeObj = null;
  const chevTex = canvasTex(64, 32, (g) => {
    g.clearRect(0, 0, 64, 32);
    g.fillStyle = "#ffffff";
    g.beginPath(); g.moveTo(14, 4); g.lineTo(34, 16); g.lineTo(14, 28); g.lineTo(24, 16); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(34, 4); g.lineTo(54, 16); g.lineTo(34, 28); g.lineTo(44, 16); g.closePath(); g.fill();
  }, true);
  W.showRoute = function (pts, color) {
    W.clearRoute();
    const grp = new THREE.Group();
    const pos = [], uv = [], idx = [];
    let acc = 0;
    const hw = 2.2, y = 0.9;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.01) continue;
      const nx = (-(bz - az) / L) * hw, nz = ((bx - ax) / L) * hw;
      const k = pos.length / 3;
      pos.push(ax + nx, y, az + nz, ax - nx, y, az - nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
      uv.push(acc / 7, 1, acc / 7, 0, (acc + L) / 7, 1, (acc + L) / 7, 0);
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      acc += L;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const base = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    const tex = chevTex.clone(); tex.needsUpdate = true; tex.wrapS = THREE.RepeatWrapping;
    const arrows = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    arrows.position.y = 0.05;
    base.renderOrder = arrows.renderOrder = 3;
    grp.add(base, arrows);
    // travelling dot
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    dot.scale.set(16, 16, 1);
    grp.add(dot);
    const cum = [0];
    for (let i = 0; i < pts.length - 1; i++) cum.push(cum[i] + Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]));
    const total = cum[cum.length - 1];
    routeObj = { grp, tex, dot, pts, cum, total, s: 0 };
    scene.add(grp);
  };
  W.clearRoute = function () {
    if (!routeObj) return;
    scene.remove(routeObj.grp);
    routeObj.grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    routeObj = null;
  };
  W.onFrame((dt) => {
    if (!routeObj) return;
    routeObj.tex.offset.x -= dt * 1.4;
    const r = routeObj;
    r.s = (r.s + dt * Math.max(60, r.total / 6)) % (r.total || 1);
    let k = 1;
    while (k < r.cum.length - 1 && r.cum[k] < r.s) k++;
    const a = r.pts[k - 1], b = r.pts[k], seg = r.cum[k] - r.cum[k - 1] || 1, f = (r.s - r.cum[k - 1]) / seg;
    r.dot.position.set(a[0] + (b[0] - a[0]) * f, 2.5, a[1] + (b[1] - a[1]) * f);
  });

  // ------------------------------------------------------------ decorations per layer
  ["market", "meet", "event", "task", "care", "report", "safe", "solar", "fx"].forEach((k) => { groups[k] = new THREE.Group(); });
  W.groups = groups;
  W.addToScene = () => ["market", "meet", "event", "task", "care", "report", "safe", "solar", "fx"].forEach((k) => scene.add(groups[k]));

  W.frontOf = function (u, dist = 2.5) {
    const rd = W.nearestRoad(u.x, u.z, (r) => !["footway", "path", "steps"].includes(r.t));
    const dx = rd.x - u.x, dz = rd.z - u.z, L = Math.hypot(dx, dz) || 1;
    return { x: u.x + (dx / L) * (u.d / 2 + dist), z: u.z + (dz / L) * (u.d / 2 + dist), road: rd };
  };

  W.addStall = function (x, z, colorHex) {
    const g = new THREE.Group();
    const stripes = canvasTex(64, 8, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#ffffff" : colorHex; c.fillRect(i * 8, 0, 8, 8); } });
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.3, 8, 1, true), new THREE.MeshLambertMaterial({ map: stripes, side: THREE.DoubleSide }));
    top.position.y = 3.4;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 5), new THREE.MeshLambertMaterial({ color: 0x5a5a5a }));
    pole.position.y = 1.7;
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.1), new THREE.MeshLambertMaterial({ color: 0xc69a62 }));
    table.position.y = 0.45;
    [top, pole, table].forEach((m) => { m.castShadow = true; g.add(m); });
    g.position.set(x, 0, z);
    groups.market.add(g);
    return g;
  };

  // Event marquee: white canopy tent with coloured bunting and a flag; competitions get a spinning trophy.
  W.addTent = function (x, z, colorHex, contest) {
    const g = new THREE.Group();
    const col = new THREE.Color(colorHex);
    const S = 12, H = 4.2;
    const stripes = canvasTex(64, 8, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#fbfbf7" : "#" + col.getHexString(); c.fillRect(i * 8, 0, 8, 8); } });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(S * 0.75, 3.6, 4, 1), new THREE.MeshLambertMaterial({ map: stripes }));
    roof.rotation.y = Math.PI / 4; roof.position.y = H + 1.8; roof.castShadow = true;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.53, S * 0.53, 0.7, 4, 1, true), new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }));
    skirt.rotation.y = Math.PI / 4; skirt.position.y = H - 0.35;
    g.add(roof, skirt);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
    for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, H, 5), poleMat);
      p.position.set((px * S) / 2.7, H / 2, (pz * S) / 2.7);
      g.add(p);
    }
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.9), new THREE.MeshLambertMaterial({ color: 0xc69a62 }));
      t.position.set(-2.4 + (i % 2) * 4.8, 0.35, -1.8 + Math.floor(i / 2) * 3.6);
      t.castShadow = true;
      g.add(t);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 11, 5), poleMat);
    mast.position.set(S / 2 + 1, 5.5, 0);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.1, 6, 1), new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }));
    flag.position.set(S / 2 + 2.9, 9.8, 0);
    g.add(mast, flag);
    let trophy = null;
    if (contest) {
      trophy = new THREE.Group();
      const gold = new THREE.MeshPhongMaterial({ color: 0xf2bf3a, emissive: 0x6b4a00, shininess: 110 });
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.5, 1.6, 16, 1, true), gold);
      cup.material.side = THREE.DoubleSide; cup.position.y = 1.6;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 8), gold);
      stem.position.y = 0.45;
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.2), gold);
      trophy.add(cup, stem, base);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.glowTex, color: 0xffcf5a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.set(9, 9, 1); halo.position.y = 1.2;
      trophy.add(halo);
      trophy.position.y = H + 6;
      g.add(trophy);
    }
    g.position.set(x, 0, z);
    groups.event.add(g);
    const ph = R() * 6, pos = flag.geometry.attributes.position, base0 = Float32Array.from(pos.array);
    W.onFrame((dt, t) => {
      for (let i = 0; i < pos.count; i++) { const px = base0[i * 3]; pos.setZ(i, Math.sin(t * 4 + px * 2 + ph) * 0.25 * (px + 1.3) / 2.6); }
      pos.needsUpdate = true;
      if (trophy) { trophy.rotation.y += dt * 1.2; trophy.position.y = H + 6 + Math.sin(t * 2 + ph) * 0.4; }
    });
    return g;
  };

  W.addBeacon = function (x, z, colorHex) {
    const g = new THREE.Group();
    const grad = canvasTex(4, 128, (c) => {
      const gr = c.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.7, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,1)");
      c.fillStyle = gr; c.fillRect(0, 0, 4, 128);
    });
    const col = new THREE.Color(colorHex);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.5, 46, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: col, alphaMap: grad, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.y = 23;
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.5, 7, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.6;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.5;
    g.add(beam, ring, disc);
    g.position.set(x, terrainHeight(x, z), z);
    groups.meet.add(g);
    const ph = R() * 6;
    W.onFrame((dt, t) => {
      const k = ((t + ph) % 2.2) / 2.2;
      ring.scale.setScalar(1 + k * 2.2);
      ring.material.opacity = 0.8 * (1 - k);
      beam.material.opacity = 0.42 + Math.sin(t * 2 + ph) * 0.12 + nightT * 0.25;
    });
    return g;
  };

  W.addQuest = function (x, y, z, colorHex) {
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(2.1), new THREE.MeshPhongMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.35, shininess: 90, flatShading: true }));
    gem.scale.y = 1.4;
    gem.castShadow = true;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.glowTex, color: colorHex, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(13, 13, 1);
    g.add(halo, gem);
    g.position.set(x, y, z);
    groups.task.add(g);
    const ph = R() * 6;
    W.onFrame((dt, t) => { gem.rotation.y += dt * 1.4; g.position.y = y + Math.sin(t * 2 + ph) * 0.8; });
    return g;
  };

  W.addPool = function (x, y, z, frac, colorHex) {
    const g = new THREE.Group();
    const H = 11, Rr = 3.4;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(Rr, Rr, H, 28, 1, true), new THREE.MeshPhongMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.28, shininess: 120, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.y = H / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(Rr, 0.22, 6, 28), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    rim.rotation.x = Math.PI / 2; rim.position.y = H;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(Rr + 0.4, Rr + 0.6, 0.8, 28), new THREE.MeshLambertMaterial({ color: 0xf3f0ea }));
    const liquidGeo = new THREE.CylinderGeometry(Rr - 0.25, Rr - 0.25, 1, 28);
    liquidGeo.translate(0, 0.5, 0);
    const liquid = new THREE.Mesh(liquidGeo, new THREE.MeshPhongMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.3, transparent: true, opacity: 0.88, shininess: 80 }));
    liquid.position.y = 0.4;
    g.add(base, liquid, glass, rim);
    // hearts
    const heartTex = canvasTex(64, 64, (c) => { c.fillStyle = "#fff"; c.font = "52px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("♥", 32, 36); });
    const hearts = [];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, color: colorHex, transparent: true, depthWrite: false }));
      s.scale.set(2.4, 2.4, 1);
      s.userData.ph = i / 4;
      g.add(s); hearts.push(s);
    }
    g.position.set(x, y, z);
    groups.care.add(g);
    const obj = { g, frac, shown: 0 };
    W.onFrame((dt, t) => {
      obj.shown += (obj.frac - obj.shown) * Math.min(1, dt * 2.5);
      liquid.scale.y = Math.max(0.05, obj.shown * (H - 0.6));
      hearts.forEach((s) => {
        const k = (t * 0.35 + s.userData.ph) % 1;
        s.position.set(Math.sin((k + s.userData.ph) * 9) * 2.2, H + k * 10, Math.cos((k + s.userData.ph) * 7) * 1.5);
        s.material.opacity = 1 - k;
      });
    });
    return obj;
  };

  W.addCamera = function (x, z, heading, online, colorHex) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 7, 6), new THREE.MeshLambertMaterial({ color: 0x4a5560 }));
    pole.position.y = 3.5; pole.castShadow = true;
    const head = new THREE.Group();
    head.position.y = 7;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 1.8), new THREE.MeshLambertMaterial({ color: online ? 0xf3f5f6 : 0x8a9095 }));
    box.position.z = 0.4;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: online ? 0xff3344 : 0x555555 }));
    led.position.set(0, 0.45, 0.9);
    head.add(box, led);
    g.add(pole, head);
    const fov = 1.15, range = 44, pan = 0.55;
    let cone = null;
    if (online) {
      const cg = new THREE.ConeGeometry(range * Math.tan(fov / 2) * 0.62, range, 28, 1, true);
      cg.translate(0, -range / 2, 0);
      cg.rotateX(-Math.PI / 2);
      cone = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      cone.rotation.x = 0.36;
      head.add(cone);
      const sector = new THREE.Mesh(new THREE.CircleGeometry(range * 0.95, 32, -Math.PI / 2 - (fov / 2 + pan), fov + pan * 2),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.16, depthWrite: false }));
      sector.rotation.x = -Math.PI / 2;
      sector.position.y = 0.45;
      g.add(sector);
      g.userData.sector = sector;
    }
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    groups.safe.add(g);
    const ph = R() * 6;
    const cam = { g, head, cone, online, x, z, heading, yaw: 0 };
    W.onFrame((dt, t) => {
      cam.yaw = Math.sin(t * 0.35 + ph) * pan;
      head.rotation.y = cam.yaw;
      if (online) led.material.color.setHex(Math.sin(t * 5 + ph) > 0 ? 0xff3344 : 0x661018);
    });
    return cam;
  };

  W.addIncident = function (x, z) {
    const g = new THREE.Group();
    const mk = (r0, r1, op) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = 0.7; return m; };
    const rings = [mk(3, 4, 0.9), mk(3, 4, 0.9), mk(3, 4, 0.9)];
    rings.forEach((r) => g.add(r));
    g.position.set(x, 0, z);
    groups.safe.add(g);
    W.onFrame((dt, t) => rings.forEach((r, i) => { const k = ((t * 0.7 + i / 3) % 1); r.scale.setScalar(1 + k * 5); r.material.opacity = 0.9 * (1 - k); }));
    return g;
  };

  // Reported issue: traffic cone and a warning sign on the road. Open issues pulse; fixed ones show a steady green ring.
  W.addReport = function (x, z, colorHex, done) {
    const g = new THREE.Group();
    const stripes = canvasTex(8, 64, (c) => { for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? "#ffffff" : "#ff6a1a"; c.fillRect(0, i * 16, 8, 16); } });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 14), new THREE.MeshLambertMaterial({ map: stripes }));
    cone.position.set(1.6, 1.3, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 1.9), new THREE.MeshLambertMaterial({ color: 0xff6a1a }));
    foot.position.set(1.6, 0.09, 0);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.2, 6), new THREE.MeshLambertMaterial({ color: 0x9aa0a6 }));
    post.position.y = 2.6;
    const signTex = canvasTex(64, 64, (c) => {
      c.fillStyle = "#ffc21a"; c.fillRect(0, 0, 64, 64);
      c.strokeStyle = "#1d1d1d"; c.lineWidth = 5; c.strokeRect(5, 5, 54, 54);
      c.save(); c.translate(32, 32); c.rotate(-Math.PI / 4);
      c.fillStyle = "#1d1d1d"; c.font = "bold 40px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("!", 0, 3); c.restore();
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.12), new THREE.MeshLambertMaterial({ map: signTex }));
    sign.rotation.z = Math.PI / 4; sign.position.y = 5.6;
    [cone, foot, post, sign].forEach((m) => { m.castShadow = true; g.add(m); });
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.2, 40), new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.6;
    g.add(ring);
    g.position.set(x, 0, z);
    groups.report.add(g);
    const obj = { g, done: !!done };
    const ph = R() * 6;
    W.onFrame((dt, t) => {
      sign.rotation.y = Math.sin(t * 0.8 + ph) * 0.5;
      if (obj.done) { ring.material.color.setHex(0x2c9a52); ring.scale.setScalar(1); ring.material.opacity = 0.7; return; }
      ring.material.color.setHex(colorHex);
      const k = ((t * 0.6 + ph) % 1);
      ring.scale.setScalar(1 + k * 1.8);
      ring.material.opacity = 0.85 * (1 - k);
    });
    return obj;
  };

  W.addSolarGlow = function () {
    const pts = [];
    W.solarSet.forEach((ui) => { const u = units[ui]; pts.push(u.x, u.top + 1.5, u.z); });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size: 22, map: W.glowTex, color: 0xffc23a, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
    groups.solar.clear();
    groups.solar.add(m);
    W.onFrame((dt, t) => { m.material.opacity = groups.solar.userData.on ? 0.55 + Math.sin(t * 2.4) * 0.25 : 0; });
  };

  // ------------------------------------------------------------ layer look
  let currentLayer = "all";
  const grey = new THREE.Color(0xc8ccc9), tmpC = new THREE.Color();
  W.setLayerLook = function (layer) {
    currentLayer = layer;
    ["market", "meet", "event", "task", "care", "report", "safe"].forEach((k) => {
      groups[k].visible = layer === "all" || layer === k;
    });
    groups.solar.userData.on = layer === "solar";
    // camera cones louder in safety layer
    groups.safe.traverse((o) => {
      if (o.material && o.material.blending === THREE.AdditiveBlending && o.geometry && o.geometry.type === "ConeGeometry") o.material.opacity = layer === "safe" ? 0.22 : 0.12;
      if (o.material && o.geometry && o.geometry.type === "CircleGeometry") o.material.opacity = layer === "safe" ? 0.22 : 0.0;
    });
    const solar = layer === "solar";
    units.forEach((u, i) => {
      if (solar && !W.solarSet.has(i)) tmpC.copy(unitBaseColors[i]).lerp(grey, 0.65);
      else tmpC.copy(unitBaseColors[i]);
      unitMesh.setColorAt(i, tmpC);
      if (solar && !W.solarSet.has(i)) roofMesh.setColorAt(i, tmpC.copy(u.roofColor).lerp(grey, 0.7));
      else roofMesh.setColorAt(i, u.roofColor);
    });
    unitMesh.instanceColor.needsUpdate = true;
    roofMesh.instanceColor.needsUpdate = true;
    W.panelMat.emissive.setHex(solar ? 0x3a2a00 : 0x000000);
  };

  W.highlightUnit = (function () {
    let ring = null;
    return function (ui, colorHex) {
      if (ring) { scene.remove(ring); ring = null; }
      if (ui == null) return;
      const u = units[ui];
      const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(u.w + 0.6, u.top + 0.6, u.d + 1.6));
      ring = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: colorHex || 0xffc23a }));
      ring.position.set(u.x, (u.top + 0.6) / 2, u.z);
      ring.rotation.y = -u.rot;
      scene.add(ring);
    };
  })();

  // ------------------------------------------------------------ day / night
  function applyNight(k) {
    scene.background.copy(SKY_DAY).lerp(SKY_NIGHT, k);
    scene.fog.color.copy(scene.background);
    groundMesh.material.color.copy(groundMesh.material.map ? new THREE.Color(0xffffff) : GROUND_DAY).lerp(groundMesh.material.map ? new THREE.Color(0x667388) : GROUND_NIGHT, k);
    hemi.intensity = 0.62 - k * 0.4;
    hemi.color.setHex(0xe9f5ff).lerp(new THREE.Color(0x5d77a8), k);
    hemi.groundColor.setHex(0x7d8b62).lerp(new THREE.Color(0x141c24), k);
    sun.intensity = 0.72 - k * 0.5;
    sun.color.setHex(0xfff0d8).lerp(new THREE.Color(0x9db4ff), k);
    nightMats.forEach((n) => n.mat[n.prop].copy(n.day).lerp(n.night, k));
    featureMeshes.forEach((mesh) => {
      if (mesh.userData.roofBaseColor) mesh.material[0].color.copy(mesh.userData.roofBaseColor).multiplyScalar(1 - k * 0.75);
    });
    lampPoints.visible = k > 0.01;
    lampPoints.material.opacity = k;
  }
  W.setNight = function (on, instant) { nightTarget = on ? 1 : 0; if (instant) { nightT = nightTarget; applyNight(nightT); } };
  W.isNight = () => nightTarget === 1;
  W.setUiTheme = function (mode) {
    uiTheme = mode === 'terminal' || mode === 'dark' ? mode : 'accessible';
    SKY_DAY.setHex(uiTheme === 'terminal' ? 0x050b0a : uiTheme === 'dark' ? 0x102426 : 0xdce5dc);
    if (scene) {
      scene.background.copy(SKY_DAY).lerp(SKY_NIGHT, nightT);
      scene.fog.color.copy(scene.background);
    }
  };

  // ------------------------------------------------------------ camera moves
  let fly = null;
  W.flyTo = function (x, z, opts = {}) {
    const dist = opts.dist || 170;
    const tg = controls.target;
    const off = camera.position.clone().sub(tg);
    const curPolar = Math.acos(Math.max(-1, Math.min(1, off.y / off.length())));
    const polar = opts.polar != null ? opts.polar : Math.min(curPolar, controls.maxPolarAngle);
    const az = opts.azimuth != null ? opts.azimuth : Math.atan2(off.x, off.z);
    const endOff = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az)).multiplyScalar(dist);
    const t1 = new THREE.Vector3(x, terrainHeight(x, z), z);
    if (opts.offset) {
      // keep the focused spot inside the part of the screen not covered by panels
      const k = (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / (renderer.domElement.clientHeight || 1);
      const rx = Math.cos(az), rz = -Math.sin(az), fx = -Math.sin(az), fz = -Math.cos(az);
      const fwd = (opts.offset.dy * k) / Math.max(0.35, Math.cos(polar));
      t1.x += -rx * opts.offset.dx * k + fx * fwd;
      t1.z += -rz * opts.offset.dx * k + fz * fwd;
    }
    fly = { t: 0, dur: TK.instantFly ? 0.001 : opts.dur || 1.1, t0: tg.clone(), t1, o0: off, o1: endOff };
  };
  function stepFly(dt) {
    fly.t += dt / fly.dur;
    const k = ease(Math.min(1, fly.t));
    controls.target.lerpVectors(fly.t0, fly.t1, k);
    const o = fly.o0.clone().lerp(fly.o1, k);
    camera.position.copy(controls.target).add(o);
    if (fly.t >= 1) fly = null;
  }
  let viewTopDown = false;
  let orbitBeforePlan = { polar: 0.83, azimuth: 0.55 };
  W.setTopDown = function (on) {
    if (on === viewTopDown) return;
    viewTopDown = on;
    const offset = camera.position.clone().sub(controls.target);
    if (on) {
      orbitBeforePlan = { polar: Math.acos(Math.max(-1, Math.min(1, offset.y / offset.length()))), azimuth: Math.atan2(offset.x, offset.z) };
      controls.minPolarAngle = 0; controls.maxPolarAngle = 0.02; controls.enableRotate = false;
      W.flyTo(controls.target.x, controls.target.z, { polar: 0.01, azimuth: 0, dist: Math.max(380, offset.length()) });
    } else {
      controls.minPolarAngle = 0.05; controls.maxPolarAngle = 1.22; controls.enableRotate = true;
      W.flyTo(controls.target.x, controls.target.z, { polar: orbitBeforePlan.polar, azimuth: orbitBeforePlan.azimuth, dist: offset.length() });
    }
  };
  W.cameraDistance = () => camera.position.distanceTo(controls.target);

  // ------------------------------------------------------------ projection / picking
  const v3 = new THREE.Vector3();
  W.project = function (x, y, z, out) {
    v3.set(x, y, z).project(camera);
    const c = renderer.domElement;
    out.x = (v3.x * 0.5 + 0.5) * c.clientWidth;
    out.y = (-v3.y * 0.5 + 0.5) * c.clientHeight;
    out.z = v3.z;
    out.visible = v3.z < 1 && v3.z > -1;
    return out;
  };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function setRay(cx, cy) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  W.pickGround = function (cx, cy) {
    setRay(cx, cy);
    const hit = ray.intersectObject(groundMesh)[0];
    return hit && inBounds(hit.point.x, hit.point.z) ? { x: hit.point.x, z: hit.point.z } : null;
  };
  W.pickHouse = function (cx, cy) {
    setRay(cx, cy);
    const hit = ray.intersectObjects([unitMesh, roofMesh])[0];
    return hit ? hit.instanceId : null;
  };

  // ------------------------------------------------------------ CCTV feed (renders the scene from a camera head)
  let rt = null, feedCam = null, pixels = null;
  W.renderFeed = function (cam, ctx, w, h) {
    if (!rt) {
      rt = new THREE.WebGLRenderTarget(w, h);
      feedCam = new THREE.PerspectiveCamera(62, w / h, 0.5, 900);
      pixels = new Uint8Array(w * h * 4);
    }
    const yaw = cam.heading + cam.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    feedCam.position.set(cam.x + fx * 1.4, 6.8, cam.z + fz * 1.4);
    feedCam.lookAt(cam.x + fx * 30, 0, cam.z + fz * 30);
    const markersVisible = groups.safe.visible;
    groups.safe.visible = false;
    renderer.setRenderTarget(rt);
    renderer.render(scene, feedCam);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, pixels);
    renderer.setRenderTarget(null);
    groups.safe.visible = markersVisible;
    const img = ctx.createImageData(w, h);
    const night = nightT;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = ((h - 1 - y) * w + x) * 4, di = (y * w + x) * 4;
        let l = pixels[si] * 0.3 + pixels[si + 1] * 0.59 + pixels[si + 2] * 0.11;
        l = l * (1 + night * 1.6) + (Math.random() - 0.5) * 26;
        const vx = x / w - 0.5, vy = y / h - 0.5;
        l *= 1 - (vx * vx + vy * vy) * 1.3;
        if (y % 3 === 0) l *= 0.9;
        img.data[di] = l * (night ? 0.75 : 0.92);
        img.data[di + 1] = l * (night ? 1.05 : 1.0);
        img.data[di + 2] = l * (night ? 0.8 : 0.95);
        img.data[di + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  function inBounds(x, z) {
    return x >= bounds[0] && x <= bounds[1] && z >= bounds[2] && z <= bounds[3];
  }

  function disposeObjects(objects) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    objects.forEach((object) => object.traverse((child) => {
      if (child.geometry) geometries.add(child.geometry);
      if (child.userData.flatGeometry) geometries.add(child.userData.flatGeometry);
      const list = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
      list.forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value) => { if (value && value.isTexture) textures.add(value); });
      });
    }));
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
  }

  W.highlightFeature = function (id) {
    selectedFeatureId = id;
    selectionLines.forEach((line) => scene.remove(line));
    disposeObjects(selectionLines);
    selectionLines = [];
    if (id === null) return;
    scene.updateMatrixWorld(true);
    featureMeshes.filter((mesh) => mesh.userData.featureId === id).forEach((mesh) => {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0xffb52f, depthTest: false }));
      edges.matrix.copy(mesh.matrixWorld);
      edges.matrixAutoUpdate = false;
      edges.renderOrder = 6;
      scene.add(edges);
      selectionLines.push(edges);
    });
  };

  W.setHeightScale = function (scale) {
    const next = Math.min(20, Math.max(0.1, scale));
    if (next === buildingHeightScale) return;
    buildingHeightScale = next;
    placeBuildings();
    if (selectedFeatureId !== null) W.highlightFeature(selectedFeatureId);
  };

  W.pickFeature = function (cx, cy) {
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    setRay(cx, cy);
    const hits = ray.intersectObjects(featureMeshes.filter((mesh) => mesh.visible), false);
    const hit = hits.find((item) => inBounds(item.point.x, item.point.z));
    return hit ? hit.object.userData.featureId || null : null;
  };

  W.pickProposal = function (cx, cy) {
    setRay(cx, cy);
    const hit = ray.intersectObject(groups.meet, true).find((item) => inBounds(item.point.x, item.point.z));
    let object = hit && hit.object;
    while (object && object !== groups.meet) {
      if (object.userData.proposalId !== undefined) return object.userData.proposalId;
      object = object.parent;
    }
    return null;
  };

  W.setProposals = function (proposals) {
    if (proposalFrameStart === null) proposalFrameStart = frameFns.length;
    frameFns.splice(proposalFrameStart);
    disposeObjects([...groups.meet.children]);
    groups.meet.clear();
    const colors = { garden: '#70bf68', basin: '#318bbd', tanks: '#ecb357' };
    proposals.slice(0, 100).forEach((proposal) => {
      if (!Number.isFinite(proposal.x) || !Number.isFinite(proposal.z) || !inBounds(proposal.x, proposal.z) || !colors[proposal.type]) return;
      const marker = W.addBeacon(proposal.x, proposal.z, colors[proposal.type]);
      marker.userData.proposalId = proposal.id;
      const icon = canvasTex(64, 64, (context) => {
        context.fillStyle = colors[proposal.type]; context.strokeStyle = '#ffffff'; context.lineWidth = 5;
        context.beginPath(); context.arc(32, 32, 27, 0, Math.PI * 2); context.fill(); context.stroke();
        context.fillStyle = '#ffffff'; context.font = 'bold 34px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
        context.fillText(proposal.type === 'basin' ? 'B' : proposal.type === 'garden' ? 'G' : 'T', 32, 34);
      });
      const callout = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon, depthTest: false, depthWrite: false, sizeAttenuation: false }));
      callout.position.y = 58;
      callout.scale.set(0.026, 0.026, 1);
      callout.renderOrder = 5;
      marker.add(callout);
      const footprint = proposal.type === 'basin'
        ? new THREE.PlaneGeometry(Math.sqrt(4000), Math.sqrt(1000))
        : new THREE.CircleGeometry(Math.sqrt((proposal.type === 'garden' ? 150 : 100) / Math.PI), 32);
      footprint.rotateX(-Math.PI / 2);
      const ground = new THREE.Mesh(footprint, new THREE.MeshBasicMaterial({ color: colors[proposal.type], transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      ground.position.y = 0.4;
      marker.add(ground);
    });
  };

  function fittedDistance() {
    const polar = viewTopDown ? 0.01 : 0.83, azimuth = viewTopDown ? 0 : 0.55;
    const direction = new THREE.Vector3(Math.sin(polar) * Math.sin(azimuth), Math.cos(polar), Math.sin(polar) * Math.cos(azimuth));
    const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
    const up = direction.clone().cross(right);
    const tanV = Math.tan(camera.fov * Math.PI / 360), tanH = tanV * camera.aspect;
    let distance = 0;
    for (const x of [bounds[0], bounds[1]]) for (const z of [bounds[2], bounds[3]]) {
      const corner = new THREE.Vector3(x, 0, z);
      distance = Math.max(distance, corner.dot(direction) + Math.max(Math.abs(corner.dot(up)) / tanV, Math.abs(corner.dot(right)) / tanH));
    }
    return { distance: distance * 1.02, direction };
  }
  W.fitView = function (instant) {
    const { distance, direction } = fittedDistance();
    controls.maxDistance = Math.max(viewSize * 2.2, distance * 1.5);
    controls.enableRotate = !viewTopDown;
    controls.minPolarAngle = viewTopDown ? 0 : 0.05;
    controls.maxPolarAngle = viewTopDown ? 0.02 : 1.22;
    if (instant) {
      const elevation = terrainHeight(0, 0);
      controls.target.set(0, elevation, 0);
      camera.position.copy(direction.multiplyScalar(distance)).add(controls.target);
      camera.lookAt(controls.target);
      controls.update();
    } else W.flyTo(0, 0, { dist: distance, polar: viewTopDown ? 0.01 : 0.83, azimuth: viewTopDown ? 0 : 0.55, dur: 0.65 });
  };
  W.resetView = () => W.fitView(false);

  let aerialPending = null;
  let aerialUrl = null;
  let aerialEnabled = false;
  let vectorGroundMaterial = null;
  let photoMaterial = null;
  let disposed = false;
  let sampledRoofColors = 0;

  function sampleRoofColors(texture) {
    const image = texture.image;
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const oldCaps = new Set();
    featureMeshes.filter((mesh) => mesh.userData.building).forEach((mesh) => {
      const building = mesh.userData.building;
      const xs = building.p.map((point) => point[0]), zs = building.p.map((point) => point[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const points = [];
      for (const fractionX of [0.5, 0.35, 0.65]) for (const fractionZ of [0.5, 0.35, 0.65]) {
        const x = minX + (maxX - minX) * fractionX, z = minZ + (maxZ - minZ) * fractionZ;
        if (inBounds(x, z) && pip(x, z, building.p) && !(building.h || []).some((hole) => pip(x, z, hole))) points.push([x, z]);
      }
      const samples = [[], [], []];
      points.forEach(([x, z]) => {
        const col = Math.floor((x - bounds[0]) / (bounds[1] - bounds[0]) * image.width);
        const row = Math.floor((z - bounds[2]) / (bounds[3] - bounds[2]) * image.height);
        if (col < 0 || row < 0 || col >= image.width || row >= image.height) return;
        const offset = (row * image.width + col) * 4;
        for (let channel = 0; channel < 3; channel++) samples[channel].push(pixels[offset + channel]);
      });
      if (!samples[0].length) return;
      const rgb = samples.map((values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)] / 255);
      if (rgb[1] > rgb[0] * 1.16 && rgb[1] > rgb[2] * 1.12) return;
      const roof = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...rgb) });
      oldCaps.add(mesh.material[0]);
      mesh.material[0] = roof;
      mesh.userData.roofBaseColor = roof.color.clone();
      mesh.userData.roofColourSource = 'Approximate median colour sampled inside the footprint from displayed Esri imagery; not surveyed roof material.';
      sampledRoofColors += 1;
    });
    oldCaps.forEach((material) => {
      if (!featureMeshes.some((mesh) => Array.isArray(mesh.material) && mesh.material.includes(material))) material.dispose();
    });
  }

  W.captureFrame = function () {
    if (disposed) throw new Error('The 3D engine is no longer active');
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  };

  W.getStats = () => ({
    buildings: D.buildings.length, features: featureMeshes.length, proposals: groups.meet.children.length,
    aerialReady: !!aerialTexture, aerialVisible: aerialEnabled && !!photoMaterial, sampledRoofColors,
    uiTheme, sceneBackground: scene.background.getHexString(),
    heightScale: buildingHeightScale, bounds: [...bounds], selectedFeatureId, topDown: viewTopDown, night: nightTarget === 1,
    terrainReady: !!terrainGrid, terrainMinM: terrainMinimumM, terrainMaxM: terrainMaximumM, terrainVerticalScale: 1,
    flood: { ...floodStats, renderedVertices: floodMesh ? floodMesh.geometry.drawRange.count : 0 },
    camera: { position: camera.position.toArray(), target: controls.target.toArray() },
    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
    renderCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
  });

  W.setAerialGround = function (enabled, centre, width, depth) {
    aerialEnabled = enabled;
    if (!vectorGroundMaterial) vectorGroundMaterial = groundMesh.material;
    const show = () => {
      if (disposed) return false;
      if (!photoMaterial && aerialTexture) photoMaterial = new THREE.MeshBasicMaterial({ map: aerialTexture });
      groundMesh.material = aerialEnabled && photoMaterial ? photoMaterial : vectorGroundMaterial;
      groundLayers.forEach((object) => { object.visible = !aerialEnabled || !photoMaterial; });
      applyNight(nightT);
      return aerialEnabled && !!photoMaterial;
    };
    if (!enabled) return Promise.resolve(show());
    if (aerialTexture) return Promise.resolve(show());
    if (aerialPending) return aerialPending.then(show);
    const latitude = centre[1] * Math.PI / 180;
    const halfY = (depth || viewSize) / 2 / 6371008.8 * 180 / Math.PI;
    const halfX = (width || viewSize) / 2 / (6371008.8 * Math.cos(latitude)) * 180 / Math.PI;
    const imageHeight = Math.max(256, Math.round(2048 * halfY / halfX));
    const params = new URLSearchParams({
      bbox: [centre[0] - halfX, centre[1] - halfY, centre[0] + halfX, centre[1] + halfY].join(','),
      bboxSR: '4326', imageSR: '4326', size: `2048,${imageHeight}`, format: 'jpg', f: 'image',
    });
    aerialUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params}`;
    const request = ++aerialRequest;
    aerialPending = new Promise((resolve, reject) => {
      new THREE.TextureLoader().setCrossOrigin('anonymous').load(aerialUrl, (texture) => {
        if (disposed || request !== aerialRequest) { texture.dispose(); resolve(false); return; }
        aerialTexture = texture;
        try { sampleRoofColors(texture); } catch (_) { sampledRoofColors = 0; }
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        resolve(show());
      }, undefined, () => {
        aerialPending = null;
        reject(new Error('Aerial imagery is unavailable. The mapped vector scene remains available.'));
      });
    });
    return aerialPending;
  };

  W.dispose = function () {
    if (disposed) return;
    disposed = true;
    aerialRequest += 1;
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', W.resize);
    viewportObserver?.disconnect();
    controls.dispose();
    disposeObjects([scene]);
    vectorGroundMaterial?.dispose();
    photoMaterial?.dispose();
    aerialTexture?.dispose();
    frameFns.length = 0;
    renderer.dispose();
    renderer.forceContextLoss();
  };

})();
