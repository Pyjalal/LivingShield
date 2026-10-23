import type { FloodComparisonResult, FloodSimulationInput } from './model.ts';

export interface FloodStorageInsight {
  id: string | number;
  type: string;
  capacityM3: number;
  storedM3: number;
  captureRateM3s: number | null;
  cellIndex: number;
  usedFraction: number;
  status: 'full' | 'partial' | 'unused';
}

export interface FloodComparisonInsight {
  proposalCount: number;
  capacityM3: number;
  storedM3: number;
  unusedCapacityM3: number;
  capacityUsedFraction: number | null;
  counts: { full: number; partial: number; unused: number };
  storage: FloodStorageInsight[];
  final: { beforeSurfaceM3: number; afterSurfaceM3: number; surfaceChangeM3: number };
  peakWet: { beforeM2: number; afterM2: number; changeM2: number };
  budget: {
    initialSurfaceM3: number;
    rainM3: number;
    runoffLossM3: number;
    surfaceM3: number;
    storedM3: number;
    drainageM3: number;
    outflowM3: number;
    residualM3: number;
  };
}

export function summarizeFloodComparison(
  input: FloodSimulationInput,
  comparison: FloodComparisonResult,
): FloodComparisonInsight {
  const before = comparison.before.metrics;
  const after = comparison.after.metrics;
  const proposals = new Map((input.proposals ?? []).map((proposal) => [proposal.id, proposal]));
  const storage = comparison.after.storage.map((result): FloodStorageInsight => {
    const status =
      result.storedM3 <= 1e-6
        ? 'unused'
        : result.capacityM3 - result.storedM3 <= 1e-6
          ? 'full'
          : 'partial';
    return {
      ...result,
      type: proposals.get(result.id)?.type ?? 'storage',
      usedFraction:
        result.capacityM3 > 0 ? Math.min(1, Math.max(0, result.storedM3 / result.capacityM3)) : 0,
      status,
    };
  });
  const capacityM3 = storage.reduce((sum, result) => sum + result.capacityM3, 0);
  return {
    proposalCount: storage.length,
    capacityM3,
    storedM3: after.totalStoredM3,
    unusedCapacityM3: Math.max(0, capacityM3 - after.totalStoredM3),
    capacityUsedFraction:
      capacityM3 > 0 ? Math.min(1, Math.max(0, after.totalStoredM3 / capacityM3)) : null,
    counts: {
      full: storage.filter((result) => result.status === 'full').length,
      partial: storage.filter((result) => result.status === 'partial').length,
      unused: storage.filter((result) => result.status === 'unused').length,
    },
    storage,
    final: {
      beforeSurfaceM3: before.finalSurfaceM3,
      afterSurfaceM3: after.finalSurfaceM3,
      surfaceChangeM3: after.finalSurfaceM3 - before.finalSurfaceM3,
    },
    peakWet: {
      beforeM2: before.peakWetAreaM2,
      afterM2: after.peakWetAreaM2,
      changeM2: after.peakWetAreaM2 - before.peakWetAreaM2,
    },
    budget: {
      initialSurfaceM3: after.initialSurfaceM3,
      rainM3: after.totalRainM3,
      runoffLossM3: after.totalRunoffLossM3,
      surfaceM3: after.finalSurfaceM3,
      storedM3: after.totalStoredM3,
      drainageM3: after.totalDrainageM3,
      outflowM3: after.totalOutflowM3,
      residualM3: after.massErrorM3,
    },
  };
}
