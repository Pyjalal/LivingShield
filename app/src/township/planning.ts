export interface Proposal {
  id: number;
  type: 'garden' | 'basin' | 'tanks';
  x: number;
  z: number;
}
export const SOLUTIONS = {
  garden: {
    name: 'Rain garden',
    capacity: 30,
    description: '150 m² × 0.20 m active storage',
    color: '#9bd586',
  },
  basin: {
    name: 'Detention court',
    capacity: 1500,
    description: '2,000 m² × 0.75 m active storage',
    color: '#62d5d1',
  },
  tanks: {
    name: 'Roof tank cluster',
    capacity: 300,
    description: '100 tanks × 3 m³',
    color: '#ffc16e',
  },
} as const;
export function sanitizeProposals(value: unknown): Proposal[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<number>();
  return value
    .filter((p): p is Proposal => {
      if (
        !p ||
        typeof p !== 'object' ||
        typeof p.type !== 'string' ||
        !Object.hasOwn(SOLUTIONS, p.type) ||
        !Number.isFinite(p.id) ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.z) ||
        Math.abs(p.x) > 750 ||
        Math.abs(p.z) > 750 ||
        ids.has(p.id)
      )
        return false;
      ids.add(p.id);
      return true;
    })
    .slice(0, 30);
}
