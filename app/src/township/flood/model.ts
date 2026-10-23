export interface FloodTerrain {
  cols: number;
  rows: number;
  dxM: number;
  dzM: number;
  originX: number;
  originZ: number;
  elevationsM: number[];
  source?: unknown;
}

export interface FloodStorageProposal {
  id: string | number;
  type: string;
  x: number;
  z: number;
  capacityM3: number;
  captureRateM3s?: number;
}

export interface FloodSimulationInput {
  terrain: FloodTerrain;
  rainfallMm: number;
  durationMinutes: number;
  runoffCoefficient: number;
  roughnessManning?: number;
  drainageMmPerHour?: number;
  tailMinutes?: number;
  boundary?: 'closed' | 'free-outfall';
  proposals?: FloodStorageProposal[];
  temporalWeights?: number[];
  initialDepthsM?: number[];
  maxFrames?: number;
  wetAreaThresholdM?: number;
}

export interface FloodFrame {
  timeSeconds: number;
  depthsM: number[];
  surfaceM3: number;
  storedM3: number;
  outflowM3: number;
  drainageM3: number;
  rainM3: number;
  runoffLossM3: number;
}

export interface FloodStorageResult {
  id: string | number;
  capacityM3: number;
  captureRateM3s: number | null;
  storedM3: number;
  cellIndex: number;
}

export interface FloodMetrics {
  initialSurfaceM3: number;
  peakDepthM: number;
  peakDepthTimeSeconds: number;
  peakSurfaceM3: number;
  peakSurfaceTimeSeconds: number;
  peakWetAreaM2: number;
  peakWetTimeSeconds: number;
  wetAreaThresholdM: number;
  finalSurfaceM3: number;
  totalRainM3: number;
  totalRunoffM3: number;
  totalRunoffLossM3: number;
  totalOutflowM3: number;
  totalDrainageM3: number;
  totalStoredM3: number;
  massErrorM3: number;
  steps: number;
}

export interface FloodSimulationResult {
  method: string;
  assumptions: string[];
  frames: FloodFrame[];
  peakDepthsM: number[];
  metrics: FloodMetrics;
  storage: FloodStorageResult[];
}

export interface FloodComparison {
  before: FloodSimulationResult;
  after: FloodSimulationResult;
}

export type FloodTerrainGrid = FloodTerrain;
export type FloodComparisonResult = FloodComparison;

export interface FloodWorkerRequest {
  type: 'run';
  requestId: string | number;
  input: FloodSimulationInput;
}

export type FloodWorkerResponse =
  | { type: 'progress'; requestId: string | number; progress: number }
  | { type: 'result'; requestId: string | number; result: FloodComparison }
  | { type: 'error'; requestId: string | number; error: string };
