import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloodSimulationInput, FloodTerrain } from '../src/township/flood/model.ts';
import { simulateFlood, simulateFloodComparison } from '../src/township/flood/solver.ts';

function grid(cols = 6, rows = 6, dxM = 20): FloodTerrain {
  return {
    cols,
    rows,
    dxM,
    dzM: dxM,
    originX: (-cols * dxM) / 2,
    originZ: (-rows * dxM) / 2,
    elevationsM: new Array<number>(cols * rows).fill(10),
    source: { provider: 'Synthetic test terrain, not a real township' },
  };
}

function scenario(overrides: Partial<FloodSimulationInput> = {}): FloodSimulationInput {
  return {
    terrain: grid(),
    rainfallMm: 0,
    durationMinutes: 10,
    runoffCoefficient: 0.8,
    tailMinutes: 0,
    boundary: 'closed',
    maxFrames: 10,
    ...overrides,
  };
}

function assertConservation(result: ReturnType<typeof simulateFlood>, tolerance = 1e-6) {
  assert.ok(
    Math.abs(result.metrics.massErrorM3) < tolerance,
    `Mass error ${result.metrics.massErrorM3} m³`,
  );
  for (const frame of result.frames) {
    assert.ok(frame.depthsM.every((depth) => Number.isFinite(depth) && depth >= 0));
    const balance =
      result.metrics.initialSurfaceM3 +
      frame.rainM3 -
      frame.runoffLossM3 -
      frame.storedM3 -
      frame.drainageM3 -
      frame.outflowM3 -
      frame.surfaceM3;
    assert.ok(Math.abs(balance) < tolerance, `Frame mass error ${balance} m³`);
  }
}

test('zero rainfall never creates water, flux, mitigation capture or boundary inflow', () => {
  const input = scenario({
    terrain: grid(),
    boundary: 'free-outfall',
    drainageMmPerHour: 30,
    proposals: [{ id: 'basin', type: 'basin', x: 0, z: 0, capacityM3: 4000, captureRateM3s: 0.5 }],
  });
  const result = simulateFlood(input);
  for (const value of [
    result.metrics.finalSurfaceM3,
    result.metrics.totalRainM3,
    result.metrics.totalStoredM3,
    result.metrics.totalDrainageM3,
    result.metrics.totalOutflowM3,
    result.metrics.peakDepthM,
  ])
    assert.equal(value, 0);
  assert.equal(result.frames.length, input.maxFrames);
  assertConservation(result);
});

test('uniform rain on a closed flat domain has the analytic runoff depth and exact gross/loss accounting', () => {
  const terrain = grid();
  const result = simulateFlood(scenario({ terrain, rainfallMm: 90, wetAreaThresholdM: 0.05 }));
  const area = terrain.cols * terrain.rows * terrain.dxM * terrain.dzM;
  assert.ok(Math.abs(result.metrics.totalRainM3 - area * 0.09) < 1e-6);
  assert.ok(Math.abs(result.metrics.totalRunoffLossM3 - area * 0.09 * 0.2) < 1e-6);
  assert.ok(result.frames.at(-1)!.depthsM.every((depth) => Math.abs(depth - 0.072) < 1e-10));
  assert.equal(result.metrics.peakWetAreaM2, area);
  assertConservation(result);
});

test('lake at rest stays at rest on non-flat terrain with identical free-surface elevations', () => {
  const terrain = grid();
  terrain.elevationsM = terrain.elevationsM.map(
    (_, i) => 1 + (i % terrain.cols) / 4 + Math.floor(i / terrain.cols) / 7,
  );
  const initialDepthsM = terrain.elevationsM.map((height) => 5 - height);
  const result = simulateFlood(scenario({ terrain, initialDepthsM, durationMinutes: 30 }));
  result.frames
    .at(-1)!
    .depthsM.forEach((depth, i) => assert.ok(Math.abs(depth - initialDepthsM[i]) < 1e-10));
  assertConservation(result);
});

test('water routes downslope into a closed depression rather than using a global flood multiplier', () => {
  const terrain = grid(8, 8);
  terrain.elevationsM = terrain.elevationsM.map((_, i) => (7 - (i % terrain.cols)) * 0.5);
  const result = simulateFlood(
    scenario({
      terrain,
      initialDepthsM: terrain.elevationsM.map(() => 0.1),
      durationMinutes: 20,
    }),
  );
  const depths = result.frames.at(-1)!.depthsM;
  let uphill = 0;
  let downhill = 0;
  depths.forEach((depth, i) => {
    if (i % terrain.cols < 4) uphill += depth;
    else downhill += depth;
  });
  assert.ok(
    downhill > uphill * 5,
    `Expected downslope transfer: uphill=${uphill}, downhill=${downhill}`,
  );
  assert.ok(result.metrics.peakDepthM > 0.3);
  assertConservation(result);
});

test('wet/dry fronts and free-outfall perimeter remain positive and conserve water on steep small cells', () => {
  const terrain = grid(12, 12, 5);
  terrain.elevationsM = terrain.elevationsM.map(
    (_, i) => (i % terrain.cols) * 0.6 + Math.floor(i / terrain.cols) * 0.3,
  );
  const initialDepthsM = terrain.elevationsM.map((_, i) => (i === 78 ? 8 : 0));
  const result = simulateFlood(
    scenario({
      terrain,
      initialDepthsM,
      boundary: 'free-outfall',
      durationMinutes: 3,
      rainfallMm: 200,
      drainageMmPerHour: 8,
    }),
  );
  assert.ok(result.metrics.totalOutflowM3 > 0);
  assert.ok(
    result.metrics.steps > 36,
    'Small cells and deep water should tighten the CFL time step.',
  );
  assertConservation(result);
});

test('storage captures only locally wet water and respects both inlet rate and finite capacity', () => {
  const input = scenario({
    durationMinutes: 1,
    initialDepthsM: new Array<number>(36).fill(0.2),
    proposals: [
      { id: 'capacity', type: 'basin', x: -10, z: -10, capacityM3: 0.25, captureRateM3s: 5 },
      { id: 'rate', type: 'garden', x: 10, z: 10, capacityM3: 1000, captureRateM3s: 0.01 },
      { id: 'disabled', type: 'tank', x: 30, z: 30, capacityM3: 1000, captureRateM3s: 0 },
    ],
  });
  const comparison = simulateFloodComparison(input);
  assert.equal(comparison.before.metrics.totalStoredM3, 0);
  assert.equal(comparison.after.storage[0].storedM3, 0.25);
  assert.ok(Math.abs(comparison.after.storage[1].storedM3 - 0.6) < 1e-10);
  assert.equal(comparison.after.storage[2].storedM3, 0);
  assert.ok(Math.abs(comparison.after.metrics.totalStoredM3 - 0.85) < 1e-10);
  assert.ok(
    Math.abs(
      comparison.before.metrics.finalSurfaceM3 - comparison.after.metrics.finalSurfaceM3 - 0.85,
    ) < 1e-7,
  );
  assert.deepEqual(
    comparison.before.frames.map((frame) => frame.timeSeconds),
    comparison.after.frames.map((frame) => frame.timeSeconds),
  );
  assertConservation(comparison.before);
  assertConservation(comparison.after);
});

test('a basin on a dry isolated high cell cannot collect water remotely from a lower flooded cell', () => {
  const terrain = grid();
  terrain.elevationsM[0] = 100;
  const result = simulateFlood(
    scenario({
      terrain,
      initialDepthsM: terrain.elevationsM.map((_, i) => (i === 35 ? 0.1 : 0)),
      proposals: [{ id: 'disconnected', type: 'basin', x: -50, z: -50, capacityM3: 1000 }],
    }),
  );
  assert.equal(result.metrics.totalStoredM3, 0);
  assertConservation(result);
});

test('normalized temporal weights change timing but never the prescribed storm volume', () => {
  const input = scenario({ rainfallMm: 80, durationMinutes: 7, maxFrames: 15 });
  const early = simulateFlood({ ...input, temporalWeights: [9, 1, 0] });
  const late = simulateFlood({ ...input, temporalWeights: [0, 1, 9] });
  assert.ok(early.frames[4].surfaceM3 > late.frames[4].surfaceM3);
  assert.ok(Math.abs(early.metrics.totalRainM3 - late.metrics.totalRainM3) < 1e-8);
  assert.ok(Math.abs(early.metrics.finalSurfaceM3 - late.metrics.finalSurfaceM3) < 1e-8);
  assertConservation(early);
  assertConservation(late);
});

test('identical before/after runs with no mitigation are bit-for-bit equal and do not mutate inputs', () => {
  const input = scenario({
    rainfallMm: 100,
    boundary: 'free-outfall',
    temporalWeights: [1, 3, 2, 1],
  });
  const original = structuredClone(input);
  const { before, after } = simulateFloodComparison(input);
  assert.deepEqual(before, after);
  assert.deepEqual(input, original);
  assertConservation(before);
});

test('invalid terrain, rainfall, temporal distributions and out-of-domain mitigation fail explicitly', () => {
  assert.throws(
    () => simulateFlood(scenario({ terrain: { ...grid(), elevationsM: [NaN] } })),
    /finite elevation/,
  );
  assert.throws(() => simulateFlood(scenario({ rainfallMm: NaN })), /Rainfall/);
  assert.throws(() => simulateFlood(scenario({ runoffCoefficient: 1.1 })), /Runoff/);
  assert.throws(() => simulateFlood(scenario({ temporalWeights: [0, 0] })), /temporal weights/);
  assert.throws(() => simulateFlood(scenario({ temporalWeights: [1, -1] })), /temporal weights/);
  assert.throws(
    () =>
      simulateFlood(
        scenario({ proposals: [{ id: 'outside', type: 'basin', x: 70, z: 0, capacityM3: 10 }] }),
      ),
    /inside/,
  );
  assert.throws(
    () =>
      simulateFlood(
        scenario({ proposals: [{ id: 'bad', type: 'basin', x: 0, z: 0, capacityM3: -1 }] }),
      ),
    /Storage capacity/,
  );
});
