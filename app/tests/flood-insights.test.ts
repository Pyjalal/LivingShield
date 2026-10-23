import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloodSimulationInput } from '../src/township/flood/model.ts';
import { simulateFloodComparison } from '../src/township/flood/solver.ts';
import { summarizeFloodComparison } from '../src/township/flood/insights.ts';

function scenario(overrides: Partial<FloodSimulationInput> = {}): FloodSimulationInput {
  return {
    terrain: {
      cols: 3,
      rows: 2,
      dxM: 10,
      dzM: 10,
      originX: -15,
      originZ: -10,
      elevationsM: [0, 0, 10, 0, 0, 10],
    },
    rainfallMm: 0,
    durationMinutes: 1,
    runoffCoefficient: 0.7,
    tailMinutes: 0,
    maxFrames: 3,
    boundary: 'closed',
    ...overrides,
  };
}

test('capture explanations distinguish actual full, partial and unused concepts without inventing a cause', () => {
  const input = scenario({
    initialDepthsM: [0.2, 0.2, 0, 0.2, 0.2, 0],
    proposals: [
      { id: 1, type: 'basin', x: -10, z: -5, capacityM3: 1, captureRateM3s: 1 },
      { id: '1', type: 'tanks', x: 0, z: -5, capacityM3: 1000, captureRateM3s: 0.001 },
      { id: 'dry', type: 'garden', x: 10, z: -5, capacityM3: 100, captureRateM3s: 0.5 },
    ],
  });
  const result = simulateFloodComparison(input);
  const insight = summarizeFloodComparison(input, result);
  assert.deepEqual(insight.counts, { full: 1, partial: 1, unused: 1 });
  assert.equal(insight.proposalCount, 3);
  assert.equal(insight.capacityM3, 1101);
  assert.equal(insight.storage[0].type, 'basin');
  assert.equal(insight.storage[1].type, 'tanks');
  assert.equal(insight.storage[0].storedM3, 1);
  assert.ok(Math.abs(insight.storage[1].storedM3 - 0.06) < 1e-9);
  assert.equal(insight.storage[2].storedM3, 0);
  assert.equal(insight.storage[2].cellIndex, 2);
  assert.ok(Math.abs(insight.storedM3 - 1.06) < 1e-9);
  assert.ok(Math.abs(insight.unusedCapacityM3 - 1099.94) < 1e-9);
  assert.ok(Math.abs(insight.capacityUsedFraction! - 1.06 / 1101) < 1e-9);
  assert.ok(insight.final.surfaceChangeM3 < 0);
  assert.equal(Object.hasOwn(insight.storage[1], 'limitingCause'), false);
});

test('zero runoff, no concepts and zero declared capacity retain finite values and no utilization percentage', () => {
  for (const proposals of [
    [],
    [{ id: 'zero', type: 'basin', x: -10, z: -5, capacityM3: 0 }],
  ]) {
    const input = scenario({ proposals });
    const insight = summarizeFloodComparison(input, simulateFloodComparison(input));
    assert.equal(insight.storedM3, 0);
    assert.equal(insight.unusedCapacityM3, 0);
    assert.equal(insight.capacityUsedFraction, null);
    assert.equal(insight.final.surfaceChangeM3, 0);
    assert.equal(insight.peakWet.changeM2, 0);
    assert.equal(insight.counts.full, 0);
    assert.equal(insight.counts.unused, proposals.length);
    assert.ok(insight.storage.every((storage) => storage.usedFraction === 0));
  }
});

test('water accounting retains initial water, gross rain, runoff losses and independently changed sinks', () => {
  const input = scenario({
    terrain: { ...scenario().terrain, dxM: 20, dzM: 20, elevationsM: [0, 0, 0, 0, 0, 0] },
    rainfallMm: 40,
    boundary: 'free-outfall',
    drainageMmPerHour: 5,
    initialDepthsM: [0.03, 0.03, 0.03, 0.03, 0.03, 0.03],
    proposals: [{ id: 'uncapped', type: 'garden', x: -10, z: -5, capacityM3: 50 }],
  });
  const result = simulateFloodComparison(input);
  const insight = summarizeFloodComparison(input, result);
  const budget = insight.budget;
  assert.equal(insight.storage[0].captureRateM3s, null);
  assert.ok(budget.initialSurfaceM3 > 0);
  assert.ok(budget.rainM3 > 0);
  assert.ok(budget.runoffLossM3 > 0);
  assert.ok(budget.drainageM3 > 0);
  assert.ok(budget.outflowM3 > 0);
  const residual = budget.initialSurfaceM3 + budget.rainM3 - budget.runoffLossM3 -
    budget.surfaceM3 - budget.storedM3 - budget.drainageM3 - budget.outflowM3;
  assert.ok(Math.abs(residual - budget.residualM3) < 1e-8);
  assert.ok(Math.abs(budget.residualM3) < 1e-6);
  assert.equal(insight.final.surfaceChangeM3,
    result.after.metrics.finalSurfaceM3 - result.before.metrics.finalSurfaceM3);
});

test('signed comparison deltas preserve increases rather than presenting every scenario as an improvement', () => {
  const input = scenario();
  const result = simulateFloodComparison(input);
  result.after.metrics.finalSurfaceM3 = 100;
  result.before.metrics.finalSurfaceM3 = 70;
  result.after.metrics.peakWetAreaM2 = 400;
  result.before.metrics.peakWetAreaM2 = 100;
  const insight = summarizeFloodComparison(input, result);
  assert.equal(insight.final.surfaceChangeM3, 30);
  assert.equal(insight.peakWet.changeM2, 300);
  assert.equal(insight.peakWet.beforeM2, 100);
  assert.equal(insight.peakWet.afterM2, 400);
});
