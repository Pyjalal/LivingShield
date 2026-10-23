export type InstallationStage = 'existing' | 'installed' | 'established';
export type UiTheme = 'terminal' | 'dark' | 'accessible';

export interface BankInputs {
  lengthM: number;
  heightM: number;
  slopeDegrees: number;
  sparePercent: number;
  unitRateMyr: number | null;
}

export const MODULE = {
  nominalEdgeM: 0.3,
  nominalHeightM: 0.3,
  actualBoundsMm: [309.865, 308.991, 278.267],
  triangles: 33886,
  glbSha256: '5a99713a5468d5f39ad2c6cc20e5d4441910922ef15e184037f19bd45580f2bf',
  stlSha256: '3be3c348ef201910031f6ad3201f7bf2caa729211fcc36ddac78a5aeb8066b49',
} as const;

export const DEFAULT_BANK: BankInputs = {
  lengthM: 6.6,
  heightM: 0.8,
  slopeDegrees: 32,
  sparePercent: 10,
  unitRateMyr: null,
};

export function calculateBankLayout(input: BankInputs) {
  const limits = [
    [input.lengthM, 1, 60, 'Bank length'],
    [input.heightM, 0.3, 3, 'Vertical bank height'],
    [input.slopeDegrees, 20, 55, 'Bank slope'],
    [input.sparePercent, 0, 25, 'Spare allowance'],
  ] as const;
  for (const [value, min, max, name] of limits) {
    if (!Number.isFinite(value) || value < min || value > max)
      throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  if (
    input.unitRateMyr !== null &&
    (!Number.isFinite(input.unitRateMyr) || input.unitRateMyr < 0 || input.unitRateMyr > 100000)
  )
    throw new Error('A quoted unit rate must be between RM 0 and RM 100,000, or left blank.');
  const slopeRadians = (input.slopeDegrees * Math.PI) / 180;
  const slopeLengthM = input.heightM / Math.sin(slopeRadians);
  const moduleRowHeightM = (MODULE.nominalEdgeM * Math.sqrt(3)) / 2;
  const columns = Math.ceil(input.lengthM / MODULE.nominalEdgeM);
  const rows = Math.ceil(slopeLengthM / moduleRowHeightM);
  const installedModules = rows * columns * 2 - Math.floor(rows / 2);
  const spareModules = Math.ceil((installedModules * input.sparePercent) / 100);
  const orderModules = installedModules + spareModules;
  return {
    slopeRadians,
    slopeLengthM,
    horizontalRunM: input.heightM / Math.tan(slopeRadians),
    bankAreaM2: input.lengthM * slopeLengthM,
    moduleRowHeightM,
    nominalModuleAreaM2: (Math.sqrt(3) / 4) * MODULE.nominalEdgeM ** 2,
    rows,
    columns,
    installedModules,
    spareModules,
    orderModules,
    moduleSubtotalMyr: input.unitRateMyr === null ? null : orderModules * input.unitRateMyr,
  };
}

export function moduleSlots(input: BankInputs) {
  const layout = calculateBankLayout(input);
  const slots: { x: number; upSlope: number; rotation: number; row: number }[] = [];
  for (let row = 0; row < layout.rows; row++) {
    const shift = ((row % 2) * MODULE.nominalEdgeM) / 2;
    for (let index = 0; index < layout.columns * 2 - (row % 2); index++) {
      const column = Math.floor(index / 2);
      const up = index % 2 === 0;
      slots.push({
        x:
          (-layout.columns * MODULE.nominalEdgeM) / 2 +
          shift +
          column * MODULE.nominalEdgeM +
          MODULE.nominalEdgeM * (up ? 0.5 : 1),
        upSlope: row * layout.moduleRowHeightM + layout.moduleRowHeightM * (up ? 1 / 3 : 2 / 3),
        rotation: up ? 0 : Math.PI,
        row,
      });
    }
  }
  return slots;
}
