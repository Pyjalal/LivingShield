import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
} from 'geojson';

export type LngLat = [number, number];
export type TownshipBounds = [number, number, number, number];
export type TownshipId = 'bukit-raja' | 'pagoh' | 'elmina';
export type TownshipFeatureKind = 'building' | 'road' | 'water' | 'green';
export type BuildingHeightSource = 'osm-height' | 'osm-levels' | 'assumed';

export interface TownshipSource {
  url: string;
  attribution: string;
  licence: string;
  licenceUrl: string;
  anchorUrl: string;
  anchorDescription: string;
}

export interface Township {
  id: TownshipId;
  name: string;
  state: string;
  centre: LngLat;
  bbox: TownshipBounds;
  dataUrl: string;
  widthM: number;
  depthM: number;
  source: TownshipSource;
  extentDescription: string;
  identityChecks: TownshipIdentityCheck[];
}

export interface TownshipIdentityCheck {
  name: string;
  position: LngLat;
  sourceUrl: string;
  description: string;
}

const RADIUS_M = 6371008.8;
const degreesForMetres = (metres: number) => (metres / RADIUS_M) * (180 / Math.PI);

function pilot(
  id: TownshipId,
  name: string,
  state: string,
  centre: LngLat,
  anchorUrl: string,
  anchorDescription: string,
): Township {
  const halfHeight = degreesForMetres(750);
  const halfWidth = halfHeight / Math.cos((centre[1] * Math.PI) / 180);
  return {
    id,
    name,
    state,
    centre,
    bbox: [
      centre[0] - halfWidth,
      centre[1] - halfHeight,
      centre[0] + halfWidth,
      centre[1] + halfHeight,
    ],
    dataUrl: `/data/townships/${id}.geojson`,
    widthM: 1500,
    depthM: 1500,
    source: {
      url: 'https://www.openstreetmap.org/copyright',
      attribution: '© OpenStreetMap contributors',
      licence: 'Open Database Licence (ODbL) 1.0',
      licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
      anchorUrl,
      anchorDescription,
    },
    extentDescription:
      'A 1.5 km square OSM pilot window around a verified location anchor; not an official township boundary.',
    identityChecks: [],
  };
}

export const TOWNSHIPS: readonly Township[] = [
  pilot(
    'bukit-raja',
    'Bandar Bukit Raja',
    'Selangor',
    [101.437697, 3.0852015],
    'https://www.openstreetmap.org/relation/19844690',
    'Representative location returned by OSM Nominatim for the named Bandar Bukit Raja residential relation; verified 20 October 2026.',
  ),
  pilot(
    'pagoh',
    'Bandar Universiti Pagoh',
    'Johor',
    [102.733172, 2.173274],
    'https://www.simedarbyproperty.com/sites/default/files/2019-03/HarmoniPermai_simplified_Brochure_A4.pdf',
    'Bandar Universiti Pagoh sales gallery GPS coordinates printed on PDF page 10 of the developer’s Harmoni Permai brochure; this is a gallery anchor, not a township centroid.',
  ),
  pilot(
    'elmina',
    'City of Elmina',
    'Selangor',
    [101.517298, 3.180368],
    'https://www.openstreetmap.org/way/866543395',
    'Representative location returned by OSM Nominatim for the named Elmina residential way; verified 20 October 2026.',
  ),
];

TOWNSHIPS[0].identityChecks = [
  {
    name: 'Bandar Bukit Raja Sales Gallery',
    position: [101.432412, 3.086801],
    sourceUrl:
      'https://www.simedarbyproperty.com/sites/default/files/2018-07/Ayra_Brochure_web.pdf',
    description:
      'Developer brochure GPS; location is inside the pilot window. It confirms locality, not a legal township boundary.',
  },
];
TOWNSHIPS[1].identityChecks = [
  {
    name: 'Bandar Universiti Pagoh Gallery',
    position: [102.733172, 2.173274],
    sourceUrl:
      'https://www.simedarbyproperty.com/sites/default/files/2019-03/HarmoniPermai_simplified_Brochure_A4.pdf',
    description:
      'The published gallery GPS is the pilot anchor. Cached OSM footprint counts describe mapped coverage, not the township building total.',
  },
];
TOWNSHIPS[2].identityChecks = [
  {
    name: 'Elmina Pavilion',
    position: [101.523581, 3.186265],
    sourceUrl: 'https://www.simedarbyproperty.com/sites/default/files/2017-11/Elmina_Valley2.pdf',
    description:
      'Developer brochure GPS inside the pilot’s northeast corner. This window covers the Elmina Pavilion / Ilham vicinity and adjacent mapped neighbourhoods, not the entire City of Elmina.',
  },
  {
    name: 'Elmina Sales Gallery, Elmina West',
    position: [101.508137, 3.180139],
    sourceUrl: 'https://www.simedarbyproperty.com/city-of-elmina/elmina-ridge-2/',
    description:
      'Current developer page GPS about 1.02 km west of the OSM representative anchor, outside the pilot window. The pilot is not centred on this gallery or an official city centre.',
  },
];

export interface TownshipFeatureProperties {
  id: string;
  osmId?: number;
  osmType?: 'way' | 'relation';
  sourceUrl: string;
  kind: TownshipFeatureKind;
  name: string | null;
  nameSource?: 'osm-name' | 'unnamed';
  tags?: Record<string, string>;
  dataSource?: string;
  geometrySource?: 'machine-inferred';
  providerQuadkey?: string;
  providerLine?: number;
  providerUploadDate?: string;
  providerGeometrySha256?: string;
  confidence?: number | null;
  providerHeightMetres?: number | null;
  heightMetres?: number;
  heightSource?: BuildingHeightSource;
  heightAssumption?: string | null;
}

export type TownshipGeometry = Polygon | MultiPolygon | LineString | MultiLineString;
export type TownshipFeature = Feature<TownshipGeometry, TownshipFeatureProperties>;

export interface TownshipDatasetMetadata {
  townshipId: TownshipId;
  title: string;
  retrievedAt: string;
  osmBaseTimestamp: string | null;
  sourceUrl: string;
  queryUrl: string;
  query: string;
  attribution: string;
  licence: string;
  licenceUrl: string;
  bbox: TownshipBounds;
  centre: LngLat;
  extentDescription: string;
  heightAssumptions: string[];
  counts: Record<TownshipFeatureKind, number>;
  omittedIncompleteFeatures: number;
  anchorUrl: string;
  anchorDescription: string;
  identityChecks: TownshipIdentityCheck[];
  geometryNotes: string;
  audit: TownshipGeometryAudit;
}

export interface TownshipNamedFeature {
  id: string;
  name: string;
  sourceUrl: string;
  bboxCentre: LngLat;
}

export interface TownshipGeometryAudit {
  footprintCount: number;
  explicitHeightCount: number;
  mappedLevelsHeightCount: number;
  assumedHeightCount: number;
  assumedHeightFraction: number;
  surveyedHeightCount: null;
  sourceGeometryBounds: TownshipBounds;
  featuresExtendingBeyondWindow: Record<TownshipFeatureKind, number>;
  namedRoadCount: number;
  namedWaterCount: number;
  namedBuildings: TownshipNamedFeature[];
  roadExamples: TownshipNamedFeature[];
  waterExamples: TownshipNamedFeature[];
  coverageNotes: string[];
}

export interface TownshipDataset extends FeatureCollection<
  TownshipGeometry,
  TownshipFeatureProperties
> {
  metadata: TownshipDatasetMetadata;
}

export interface TownshipSupplementMetadata {
  townshipId: TownshipId;
  provider: string;
  providerUrl: string;
  licence: string;
  licenceUrl: string;
  licenceText: string;
  attribution: string;
  sourceUrl: string;
  catalogueUrl: string;
  catalogueRelease: string;
  retrievedAt: string;
  bbox: TownshipBounds;
  centre: LngLat;
  featureCount: number;
  sourceFiles: { url: string; quadkey: string; advertisedSize: string; uploadDate: string }[];
  imageryDate: null;
  geometrySource: 'machine-inferred';
  heightSource: 'assumed';
  sourceCandidatesInBbox: number;
  omittedOsmOverlaps: number;
  omittedDuplicateGeometries: number;
  overlapPolicy: string;
  geometryNotes: string;
  limitations: string[];
}

export interface TownshipSupplementDataset extends FeatureCollection<
  TownshipGeometry,
  TownshipFeatureProperties
> {
  metadata: TownshipSupplementMetadata;
}

export interface TownshipScenarioInput {
  rainfallMm: number;
  surfaceAreaM2: number;
  runoffCoefficient: number;
  retentionCapacityM3: number;
}

export interface TownshipScenario {
  rainfallVolumeM3: number;
  runoffM3: number;
  retainedM3: number;
  residualM3: number;
  retainedPercent: number;
}

export function calculateTownshipScenario(input: TownshipScenarioInput): TownshipScenario {
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value < 0)
      throw new RangeError(`${key} must be finite and non-negative`);
  }
  if (input.runoffCoefficient > 1)
    throw new RangeError('runoffCoefficient must be between 0 and 1');
  const rainfallVolumeM3 = (input.rainfallMm * input.surfaceAreaM2) / 1000;
  const runoffM3 = rainfallVolumeM3 * input.runoffCoefficient;
  if (!Number.isFinite(rainfallVolumeM3) || !Number.isFinite(runoffM3))
    throw new RangeError('Scenario volumes exceed the supported numeric range');
  const retainedM3 = Math.min(runoffM3, input.retentionCapacityM3);
  return {
    rainfallVolumeM3,
    runoffM3,
    retainedM3,
    residualM3: runoffM3 - retainedM3,
    retainedPercent: runoffM3 > 0 ? (retainedM3 / runoffM3) * 100 : 0,
  };
}
