(function () {
  'use strict';
  const ORIGIN = window.location.origin;
  const RADIUS = 6371008.8;
  const RADIANS = Math.PI / 180;
  const viewport = document.getElementById('viewport');
  const status = document.getElementById('status');
  const imageryCredit = document.getElementById('imagery-credit');
  const terrainCredit = document.getElementById('terrain-credit');
  const floodReadout = document.getElementById('flood-readout');
  let world = null;
  let canvas = null;
  let township = null;
  let state = {};
  let lastReset = null;
  let lastTopDown = false;
  let lastNight = false;
  let serial = Promise.resolve();
  let activeGeneration = 0;
  let lastSelectedId;
  let lastHeightScale;
  let lastProposalsSignature = null;
  let lastUiTheme = null;

  function send(type, values) {
    window.parent.postMessage({ type: `hydrogrid:${type}`, ...values }, ORIGIN);
  }

  function positive(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function project(position, centre) {
    if (!Array.isArray(position) || !Number.isFinite(position[0]) || !Number.isFinite(position[1])) return null;
    return [
      (position[0] - centre[0]) * RADIANS * RADIUS * Math.cos(centre[1] * RADIANS),
      -(position[1] - centre[1]) * RADIANS * RADIUS,
    ];
  }

  function convertDataset(dataset, selectedTownship) {
    if (!dataset || dataset.type !== 'FeatureCollection' || !Array.isArray(dataset.features)) throw new Error('A GeoJSON FeatureCollection is required');
    const centre = selectedTownship.centre;
    if (!Array.isArray(centre) || centre.length < 2 || !centre.slice(0, 2).every(Number.isFinite)) throw new Error('A valid longitude/latitude centre is required');
    const width = positive(selectedTownship.widthM, 1500);
    const depth = positive(selectedTownship.depthM, 1500);
    if (width > 5000 || depth > 5000) throw new Error('The 3D study window must be at most 5 km wide');
    const data = {
      origin: [centre[1], centre[0]], bounds: [-width / 2, width / 2, -depth / 2, depth / 2],
      roads: [], water: [], areas: [], buildings: [], units: [], boundary: [], otherHoods: {}, pois: [],
      decorativeLandmarks: false,
    };
    const line = (positions) => positions.map((p) => project(p, centre)).filter(Boolean);
    const roadWidths = { motorway: 15, motorway_link: 7, trunk: 13, primary: 12, secondary: 11, tertiary: 9, residential: 6.5, living_street: 5, service: 4, track: 3, footway: 2, path: 1.6, cycleway: 2 };
    const waterWidths = { river: 12, stream: 4, drain: 3, canal: 6, ditch: 2 };
    for (const feature of dataset.features) {
      const properties = feature.properties || {};
      const tags = properties.tags || {};
      const geometry = feature.geometry;
      if (!geometry || !geometry.coordinates) continue;
      const id = String(properties.id ?? feature.id ?? '');
      const name = properties.name || '';
      if (geometry.type === 'LineString' || geometry.type === 'MultiLineString') {
        const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
        for (const coordinates of lines) {
          const points = line(coordinates);
          if (points.length < 2) continue;
          if (properties.kind === 'road') {
            const type = tags.highway || properties.highway || 'residential';
            data.roads.push({ id, t: type, w: positive(tags.width, roadWidths[type] || 6), n: name, p: points, br: tags.bridge === 'yes' ? 1 : 0 });
          } else if (properties.kind === 'water') {
            const type = tags.waterway || 'stream';
            data.water.push({ id, w: positive(tags.width, waterWidths[type] || 4), n: name, p: points });
          }
        }
        continue;
      }
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue;
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
      for (const polygon of polygons) {
        const rings = polygon.map(line).filter((ring) => ring.length >= 4);
        if (!rings.length) continue;
        if (properties.kind === 'building') {
          data.buildings.push({
            id, k: tags.building || 'yes', l: positive(tags['building:levels'], 2), n: name,
            p: rings[0], h: rings.slice(1), heightMetres: positive(properties.heightMetres, 6),
            heightSource: properties.heightSource || 'assumed',
          });
        } else if (properties.kind === 'water' || properties.kind === 'green') {
          const category = properties.kind === 'water' ? 'water' : tags.landuse === 'forest' || tags.natural === 'wood' ? 'wood' : tags.leisure === 'pitch' ? 'pitch' : 'park';
          data.areas.push({ id, c: category, n: name, p: rings[0], h: rings.slice(1) });
        }
      }
    }
    return data;
  }

  function loadEngine() {
    return new Promise((resolve, reject) => {
      document.getElementById('tamanku-engine')?.remove();
      const script = document.createElement('script');
      script.id = 'tamanku-engine';
      script.src = './world.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('The local township engine could not be loaded'));
      document.body.appendChild(script);
    });
  }

  function bindPointerEvents() {
    let start = null;
    canvas.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary) { start = null; return; }
      if (event.button === 0) start = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('pointercancel', () => { start = null; });
    canvas.addEventListener('pointerup', (event) => {
      const down = start;
      start = null;
      if (!down || !world || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) return;
      const proposalId = world.pickProposal(event.clientX, event.clientY);
      if (proposalId !== null) { send('remove', { id: proposalId }); return; }
      if (state.placementEnabled) {
        const hit = world.pickGround(event.clientX, event.clientY);
        if (hit) send('place', hit);
      } else {
        const featureId = world.pickFeature(event.clientX, event.clientY);
        if (featureId !== null) send('select', { featureId });
      }
    });
  }

  async function updateState(values) {
    state = { ...state, ...values };
    const uiTheme = ['terminal', 'dark', 'accessible'].includes(state.uiTheme) ? state.uiTheme : 'accessible';
    document.documentElement.dataset.uiTheme = uiTheme;
    if (!world) return;
    if (uiTheme !== lastUiTheme) { world.setUiTheme(uiTheme); lastUiTheme = uiTheme; }
    if (state.terrain) world.setTerrain(state.terrain);
    terrainCredit.hidden = !world.getStats().terrainReady;
    const heightScale = positive(state.heightScale, 1);
    if (heightScale !== lastHeightScale) { world.setHeightScale(heightScale); lastHeightScale = heightScale; }
    const selectedId = state.selectedId == null ? null : String(state.selectedId);
    if (selectedId !== lastSelectedId) { world.highlightFeature(selectedId); lastSelectedId = selectedId; }
    if (Array.isArray(state.proposals)) {
      const signature = JSON.stringify(state.proposals);
      if (signature !== lastProposalsSignature) { world.setProposals(state.proposals); lastProposalsSignature = signature; }
    }
    if (state.flood) world.setFloodFrame(state.flood);
    else world.clearFlood();
    const flood = world.getStats().flood;
    floodReadout.hidden = !flood.visible;
    if (flood.visible) {
      const minutes = Math.floor(flood.timeSeconds / 60), seconds = Math.floor(flood.timeSeconds % 60);
      floodReadout.textContent = `${flood.mode === 'after' ? 'After mitigation' : 'Before mitigation'} · ${minutes}:${String(seconds).padStart(2, '0')} · maximum depth ${flood.maxDepthM.toFixed(2)} m · terrain and water 1× vertical scale`;
    }
    if (typeof state.night === 'boolean' && state.night !== lastNight) {
      lastNight = state.night;
      world.setNight(state.night);
    }
    if (typeof state.topDown === 'boolean' && state.topDown !== lastTopDown) {
      lastTopDown = state.topDown;
      world.setTopDown(state.topDown);
    }
    if (state.reset !== undefined && state.reset !== lastReset) {
      lastReset = state.reset;
      world.resetView();
    }
    if (typeof state.aerialGround === 'boolean') {
      const generation = activeGeneration;
      try {
        const visible = await world.setAerialGround(state.aerialGround, township.centre, township.widthM, township.depthM);
        if (generation === activeGeneration) imageryCredit.hidden = !visible;
      } catch (error) {
        if (generation === activeGeneration) send('error', { message: error.message, recoverable: true });
      }
    }
  }

  async function initialize(message) {
    const generation = ++activeGeneration;
    const converted = convertDataset(message.dataset, message.township);
    status.hidden = false;
    status.textContent = `Building ${message.township.name || 'the township'} from mapped footprints…`;
    if (world) world.dispose();
    world = null;
    township = message.township;
    document.getElementById('microsoft-credit').hidden = !message.dataset.features.some((feature) =>
      String(feature.properties?.id || feature.id || '').startsWith('microsoft:') ||
      String(feature.properties?.dataSource || '').includes('Microsoft'));
    state = { ...state, uiTheme: message.uiTheme ?? state.uiTheme ?? 'accessible', heightScale: message.heightScale ?? 1, proposals: message.proposals || [], aerialGround: message.aerialGround ?? true, terrain: message.terrain ?? null, flood: message.flood ?? null };
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', '3D township map. Drag to orbit, scroll to zoom, select mapped buildings.');
    canvas.tabIndex = 0;
    viewport.replaceChildren(canvas, floodReadout);
    window.KELISA_MAP = converted;
    window.TK = { SOLAR: { share: 0, showcase: [] } };
    await loadEngine();
    if (generation !== activeGeneration) return;
    world = window.TK.world;
    world.init(canvas);
    lastUiTheme = null;
    lastTopDown = false;
    lastNight = false;
    lastReset = state.reset;
    lastSelectedId = undefined;
    lastHeightScale = undefined;
    lastProposalsSignature = null;
    floodReadout.hidden = true;
    terrainCredit.hidden = true;
    bindPointerEvents();
    status.hidden = true;
    send('ready', { initialized: true, engine: 'TamanKu', townshipId: township.id, counts: { buildings: converted.buildings.length, roads: converted.roads.length, water: converted.water.length, areas: converted.areas.length } });
    void updateState(state).catch((error) => { send('error', { message: error.message, recoverable: true }); });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== ORIGIN || !event.data || typeof event.data !== 'object') return;
    const message = event.data;
    if (message.type === 'hydrogrid:init') {
      serial = serial.catch(() => {}).then(() => initialize(message)).catch((error) => {
        status.hidden = false;
        status.textContent = error.message;
        send('error', { message: error.message, recoverable: false });
      });
    } else if (message.type === 'hydrogrid:state') {
      void updateState(message).catch((error) => {
        world?.clearFlood();
        floodReadout.hidden = true;
        send('error', { message: error.message, recoverable: true });
      });
    }
  });
  const footer = document.querySelector('footer');
  const chromeObserver = new ResizeObserver(() => {
    send('chrome', { footerHeight: Math.ceil(footer.getBoundingClientRect().height) });
  });
  chromeObserver.observe(footer);
  window.addEventListener('pagehide', () => { chromeObserver.disconnect(); world?.dispose(); });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented) send('exit-presentation', {});
  });
  send('ready', { initialized: false, engine: 'TamanKu' });
})();
