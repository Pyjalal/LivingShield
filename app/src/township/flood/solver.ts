import type {
  FloodComparison,
  FloodFrame,
  FloodSimulationInput,
  FloodSimulationResult,
  FloodStorageResult,
} from './model.ts';

const G = 9.81;
const DRY_DEPTH_M = 1e-8;
const MAX_STEP_SECONDS = 5;
const COURANT = 0.35;

export const FLOOD_METHOD =
  '2D local-inertial storage-cell solver (Bates, Horritt & Fewtrell 2010), conservative wet/dry flux limiting';

interface Face {
  a: number;
  b: number;
  width: number;
  distance: number;
  bed: number;
  q: number;
  volume: number;
}

function finiteRange(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be finite and between ${min} and ${max}.`);
  }
}

function validateInput(input: FloodSimulationInput) {
  const terrain = input.terrain;
  if (!terrain) throw new Error('A sourced terrain grid is required.');
  for (const [label, value] of [
    ['columns', terrain.cols],
    ['rows', terrain.rows],
  ] as const) {
    finiteRange(value, 2, 128, `Terrain ${label}`);
    if (!Number.isInteger(value)) throw new Error(`Terrain ${label} must be an integer.`);
  }
  finiteRange(terrain.dxM, 5, 500, 'Cell width');
  finiteRange(terrain.dzM, 5, 500, 'Cell length');
  if (!Number.isFinite(terrain.originX) || !Number.isFinite(terrain.originZ)) {
    throw new Error('Terrain origin must contain finite metre coordinates.');
  }
  const count = terrain.cols * terrain.rows;
  if (
    !Array.isArray(terrain.elevationsM) ||
    terrain.elevationsM.length !== count ||
    terrain.elevationsM.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      'Terrain must provide a finite elevation for every cell; no terrain fallback is inferred.',
    );
  }
  finiteRange(input.rainfallMm, 0, 1000, 'Rainfall');
  finiteRange(input.durationMinutes, 1, 1440, 'Storm duration');
  finiteRange(input.runoffCoefficient, 0, 1, 'Runoff coefficient');
  finiteRange(input.roughnessManning ?? 0.05, 0.01, 0.3, "Manning's n");
  finiteRange(input.drainageMmPerHour ?? 0, 0, 200, 'Uniform drainage capacity');
  finiteRange(input.tailMinutes ?? 30, 0, 360, 'Post-storm duration');
  finiteRange(input.wetAreaThresholdM ?? 0.1, 0.001, 2, 'Wet-area threshold');
  if (
    input.boundary !== undefined &&
    input.boundary !== 'closed' &&
    input.boundary !== 'free-outfall'
  ) {
    throw new Error('Boundary must be closed or free-outfall.');
  }
  if (input.maxFrames !== undefined) {
    finiteRange(input.maxFrames, 2, 90, 'Frame count');
    if (!Number.isInteger(input.maxFrames)) throw new Error('Frame count must be an integer.');
  }
  if (
    input.initialDepthsM !== undefined &&
    (input.initialDepthsM.length !== count ||
      input.initialDepthsM.some((value) => !Number.isFinite(value) || value < 0 || value > 20))
  ) {
    throw new Error('Initial water depths must match the terrain and lie between 0 and 20 metres.');
  }
  if (input.temporalWeights !== undefined) {
    const weights = input.temporalWeights;
    if (
      weights.length === 0 ||
      weights.length > 4320 ||
      weights.some((weight) => !Number.isFinite(weight) || weight < 0) ||
      !Number.isFinite(weights.reduce((sum, weight) => sum + weight, 0)) ||
      weights.reduce((sum, weight) => sum + weight, 0) <= 0
    ) {
      throw new Error(
        'Rainfall temporal weights must be a non-empty, finite, non-negative series with a positive sum.',
      );
    }
  }
  if ((input.proposals?.length ?? 0) > 100)
    throw new Error('At most 100 storage proposals are supported.');
  const identifiers = new Set<string | number>();
  for (const proposal of input.proposals ?? []) {
    if (
      (typeof proposal.id !== 'string' && typeof proposal.id !== 'number') ||
      (typeof proposal.id === 'number' && !Number.isFinite(proposal.id)) ||
      identifiers.has(proposal.id)
    ) {
      throw new Error('Each storage proposal needs a unique finite ID.');
    }
    identifiers.add(proposal.id);
    finiteRange(proposal.capacityM3, 0, 1e7, 'Storage capacity');
    if (proposal.captureRateM3s !== undefined) {
      finiteRange(proposal.captureRateM3s, 0, 1000, 'Storage capture rate');
    }
    if (
      !Number.isFinite(proposal.x) ||
      !Number.isFinite(proposal.z) ||
      proposal.x < terrain.originX ||
      proposal.x > terrain.originX + terrain.cols * terrain.dxM ||
      proposal.z < terrain.originZ ||
      proposal.z > terrain.originZ + terrain.rows * terrain.dzM
    ) {
      throw new Error('Storage proposals must lie inside the terrain grid.');
    }
  }
}

function buildFaces(input: FloodSimulationInput): Face[] {
  const { cols, rows, dxM, dzM, elevationsM } = input.terrain;
  const faces: Face[] = [];
  const add = (a: number, b: number, width: number, distance: number) => {
    faces.push({
      a,
      b,
      width,
      distance,
      bed: b < 0 ? elevationsM[a] : Math.max(elevationsM[a], elevationsM[b]),
      q: 0,
      volume: 0,
    });
  };
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const i = row * cols + col;
      if (col + 1 < cols) add(i, i + 1, dzM, dxM);
      if (row + 1 < rows) add(i, i + cols, dxM, dzM);
      if ((input.boundary ?? 'free-outfall') === 'free-outfall') {
        if (col === 0 || col === cols - 1) add(i, -1, dzM, dxM / 2);
        if (row === 0 || row === rows - 1) add(i, -1, dxM, dzM / 2);
      }
    }
  }
  return faces;
}

export function simulateFlood(
  input: FloodSimulationInput,
  onProgress?: (progress: number) => void,
): FloodSimulationResult {
  validateInput(input);
  const { terrain } = input;
  const count = terrain.cols * terrain.rows;
  const area = terrain.dxM * terrain.dzM;
  const depths = Float64Array.from(input.initialDepthsM ?? new Array<number>(count).fill(0));
  const peaks = Float64Array.from(depths);
  const outgoing = new Float64Array(count);
  const changes = new Float64Array(count);
  const faces = buildFaces(input);
  const roughness = input.roughnessManning ?? 0.05;
  const wetThreshold = input.wetAreaThresholdM ?? 0.1;
  const durationSeconds = input.durationMinutes * 60;
  const totalSeconds = durationSeconds + (input.tailMinutes ?? 30) * 60;
  const maxFrames = input.maxFrames ?? 60;
  const frameInterval = totalSeconds / (maxFrames - 1);
  const weights = input.temporalWeights ?? [1];
  const sumWeights = weights.reduce((sum, weight) => sum + weight, 0);
  const cumulative = [0];
  for (const weight of weights)
    cumulative.push(cumulative[cumulative.length - 1] + weight / sumWeights);
  const rainFraction = (seconds: number) => {
    if (seconds >= durationSeconds) return 1;
    const position = (Math.max(0, seconds) / durationSeconds) * weights.length;
    const bin = Math.min(weights.length - 1, Math.floor(position));
    return cumulative[bin] + ((position - bin) * weights[bin]) / sumWeights;
  };
  const storage: FloodStorageResult[] = (input.proposals ?? []).map((proposal) => {
    const col = Math.min(
      terrain.cols - 1,
      Math.floor((proposal.x - terrain.originX) / terrain.dxM),
    );
    const row = Math.min(
      terrain.rows - 1,
      Math.floor((proposal.z - terrain.originZ) / terrain.dzM),
    );
    return {
      id: proposal.id,
      capacityM3: proposal.capacityM3,
      captureRateM3s: proposal.captureRateM3s ?? null,
      storedM3: 0,
      cellIndex: row * terrain.cols + col,
    };
  });
  const initialSurface = depths.reduce((sum, value) => sum + value * area, 0);
  let totalRain = 0;
  let totalLoss = 0;
  let totalOutflow = 0;
  let totalDrainage = 0;
  let totalStored = 0;
  let peakDepth = Math.max(...depths);
  let peakDepthTime = 0;
  let peakSurface = initialSurface;
  let peakSurfaceTime = 0;
  let peakWetArea = depths.reduce((sum, value) => sum + (value >= wetThreshold ? area : 0), 0);
  let peakWetTime = 0;
  let seconds = 0;
  let steps = 0;
  const frames: FloodFrame[] = [];
  const snapshot = () => {
    frames.push({
      timeSeconds: seconds,
      depthsM: Array.from(depths),
      surfaceM3: depths.reduce((sum, value) => sum + value * area, 0),
      storedM3: totalStored,
      outflowM3: totalOutflow,
      drainageM3: totalDrainage,
      rainM3: totalRain,
      runoffLossM3: totalLoss,
    });
    onProgress?.(seconds / totalSeconds);
  };
  snapshot();
  while (seconds < totalSeconds - 1e-7) {
    if (++steps > 200000)
      throw new Error(
        'Simulation exceeded the safe step budget; increase grid size or shorten the storm.',
      );
    let maxDepth = 0;
    for (const depth of depths) maxDepth = Math.max(maxDepth, depth);
    const possibleRainDepth =
      (input.rainfallMm / 1000) * input.runoffCoefficient * (1 - rainFraction(seconds));
    const cflStep =
      (COURANT * Math.min(terrain.dxM, terrain.dzM)) /
      Math.sqrt(G * Math.max(maxDepth + possibleRainDepth, 0.001));
    const nextFrame = Math.min(totalSeconds, frames.length * frameInterval);
    const dt = Math.min(MAX_STEP_SECONDS, cflStep, totalSeconds - seconds, nextFrame - seconds);
    const rainDepth =
      (input.rainfallMm / 1000) * Math.max(0, rainFraction(seconds + dt) - rainFraction(seconds));
    totalRain += rainDepth * area * count;
    totalLoss += rainDepth * (1 - input.runoffCoefficient) * area * count;
    for (let i = 0; i < count; i += 1) depths[i] += rainDepth * input.runoffCoefficient;
    const drainageDepth = ((input.drainageMmPerHour ?? 0) / 1000 / 3600) * dt;
    if (drainageDepth > 0) {
      for (let i = 0; i < count; i += 1) {
        const removed = Math.min(depths[i], drainageDepth);
        depths[i] -= removed;
        totalDrainage += removed * area;
      }
    }
    for (const sink of storage) {
      const captured = Math.min(
        depths[sink.cellIndex] * area,
        sink.capacityM3 - sink.storedM3,
        sink.captureRateM3s === null ? Infinity : sink.captureRateM3s * dt,
      );
      depths[sink.cellIndex] -= captured / area;
      sink.storedM3 += captured;
      totalStored += captured;
    }
    outgoing.fill(0);
    changes.fill(0);
    for (const face of faces) {
      const etaA = terrain.elevationsM[face.a] + depths[face.a];
      const etaB = face.b < 0 ? face.bed : terrain.elevationsM[face.b] + depths[face.b];
      const flowDepth = Math.max(etaA, etaB) - face.bed;
      if (flowDepth <= DRY_DEPTH_M) {
        face.q = 0;
        face.volume = 0;
        continue;
      }
      const friction = 1 + (G * dt * roughness ** 2 * Math.abs(face.q)) / flowDepth ** (7 / 3);
      face.q = (face.q - (G * flowDepth * dt * (etaB - etaA)) / face.distance) / friction;
      if (face.b < 0) face.q = Math.max(0, face.q);
      face.volume = face.q * dt * face.width;
      if (face.volume >= 0) outgoing[face.a] += face.volume;
      else outgoing[face.b] -= face.volume;
    }
    for (const face of faces) {
      const donor = face.volume >= 0 ? face.a : face.b;
      const available = depths[donor] * area;
      const factor = outgoing[donor] > available ? available / outgoing[donor] : 1;
      const volume = face.volume * factor;
      face.q *= factor;
      changes[face.a] -= volume;
      if (face.b < 0) totalOutflow += volume;
      else changes[face.b] += volume;
    }
    seconds += dt;
    let surface = 0;
    let wetArea = 0;
    for (let i = 0; i < count; i += 1) {
      depths[i] = Math.max(0, depths[i] + changes[i] / area);
      if (!Number.isFinite(depths[i]))
        throw new Error('Numerical instability detected; results were discarded.');
      peaks[i] = Math.max(peaks[i], depths[i]);
      if (depths[i] > peakDepth) {
        peakDepth = depths[i];
        peakDepthTime = seconds;
      }
      surface += depths[i] * area;
      if (depths[i] >= wetThreshold) wetArea += area;
    }
    if (surface > peakSurface) {
      peakSurface = surface;
      peakSurfaceTime = seconds;
    }
    if (wetArea > peakWetArea) {
      peakWetArea = wetArea;
      peakWetTime = seconds;
    }
    if (seconds >= nextFrame - 1e-7) snapshot();
  }
  const finalSurface = depths.reduce((sum, value) => sum + value * area, 0);
  const massError =
    initialSurface +
    totalRain -
    totalLoss -
    totalOutflow -
    totalDrainage -
    totalStored -
    finalSurface;
  if (Math.abs(massError) > Math.max(1e-6, (initialSurface + totalRain) * 1e-8)) {
    throw new Error('Water balance failed the numerical tolerance; results were discarded.');
  }
  const assumptions = [
    'Screening model; uncalibrated local-inertial surface flow, without momentum advection, sewer networks, culverts or building-scale barriers.',
    `Uniform runoff coefficient ${input.runoffCoefficient}; rainfall not becoming surface runoff is classified as a bulk loss.`,
    `Uniform Manning roughness n=${roughness}; DEM elevations are used unchanged.`,
    (input.boundary ?? 'free-outfall') === 'closed'
      ? 'Closed domain: no external water or boundary outflow.'
      : 'Free-outfall perimeter uses zero exterior water depth and allows outflow only; external catchment inflow, river levels and tides are excluded.',
    `Uniform drainage allowance ${input.drainageMmPerHour ?? 0} mm/hour; removal is bounded by locally available surface water.`,
    'Mitigation intercepts only the wet cell containing each proposal, up to its capacity and capture rate; storage begins empty and does not release within this event.',
    input.temporalWeights
      ? 'Supplied temporal weights are normalized to the entered storm rainfall.'
      : 'Uniform block rainfall over the entered storm duration.',
  ];
  if (storage.some((sink) => sink.captureRateM3s === null)) {
    assumptions.push(
      'Unspecified proposal capture rates mean instantaneous interception of water locally available in that grid cell; an inlet survey is needed.',
    );
  }
  return {
    method: FLOOD_METHOD,
    assumptions,
    frames,
    peakDepthsM: Array.from(peaks),
    metrics: {
      initialSurfaceM3: initialSurface,
      peakDepthM: peakDepth,
      peakDepthTimeSeconds: peakDepthTime,
      peakSurfaceM3: peakSurface,
      peakSurfaceTimeSeconds: peakSurfaceTime,
      peakWetAreaM2: peakWetArea,
      peakWetTimeSeconds: peakWetTime,
      wetAreaThresholdM: wetThreshold,
      finalSurfaceM3: finalSurface,
      totalRainM3: totalRain,
      totalRunoffM3: totalRain - totalLoss,
      totalRunoffLossM3: totalLoss,
      totalOutflowM3: totalOutflow,
      totalDrainageM3: totalDrainage,
      totalStoredM3: totalStored,
      massErrorM3: massError,
      steps,
    },
    storage,
  };
}

export function simulateFloodComparison(
  input: FloodSimulationInput,
  onProgress?: (progress: number) => void,
): FloodComparison {
  validateInput(input);
  const before = simulateFlood({ ...input, proposals: [] }, (progress) =>
    onProgress?.(progress / 2),
  );
  const after = simulateFlood(input, (progress) => onProgress?.(0.5 + progress / 2));
  return { before, after };
}
