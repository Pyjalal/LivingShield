import type { FloodTerrainGrid } from './model';
export interface FloodTerrainAsset extends FloodTerrainGrid {
  townshipId: string;
  minM: number;
  maxM: number;
  source: {
    title: string;
    url: string;
    notice: string;
    attribution: string;
    nativeResolutionM: number;
    retrievedAt: string;
    licence: string;
  };
  dataQuality: { zeroCells: number; notice: string };
}
export interface FloodDisplayFrame {
  cols: number;
  rows: number;
  depthsM: number[];
  timeSeconds: number;
  mode: 'before' | 'after';
  showWater: boolean;
}
