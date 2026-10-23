import type { FloodComparisonResult, FloodSimulationInput } from '../township/flood/model';
import type { BankConcept } from '../livingshield/LivingShieldView';

export interface FloodEvidence {
  townshipId: string;
  capturedAt: string;
  input: FloodSimulationInput;
  rainfallSource: Record<string, unknown>;
  comparison: FloodComparisonResult;
}

export type BankEvidence = BankConcept;

export type PlatformView =
  | 'home'
  | 'township'
  | 'living-shield'
  | 'evidence'
  | 'layers'
  | 'drainage'
  | 'flood'
  | 'precipitation'
  | 'hydrometric'
  | 'property'
  | 'engineering'
  | 'simulation'
  | 'cost';
