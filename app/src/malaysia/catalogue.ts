export interface DatasetDefinition {
  availability?: 'restricted';
  url: string;
  label: string;
  coverage: string;
  regions: string[];
  category: 'infrastructure' | 'environment' | 'flood' | 'energy';
  minZoom: number;
  type?: 'point' | 'geojson';
  description: string;
  outFields?: string;
  noPagination?: boolean;
  maxSpan?: number;
  format?: 'esri';
}
const MYGEO =
  'https://mygos.mygeoportal.gov.my/gisserver/rest/services/MyGeoname/MyGeoName_BaseMap/MapServer';
const PLAN = 'https://gisdev.planmalaysia.gov.my/server/rest/services';
const SARAWAK = 'https://gislink.sarawak.gov.my/server/rest/services';
const GEOLOGY =
  'https://mygems.jmg.gov.my/server/rest/services/Demarcation/Litology_by_Negeri/FeatureServer';
export const PENINSULAR = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Klang / Selangor',
  'Selangor',
  'Terengganu',
  'Putrajaya',
];
export const NATIONAL_DATASETS: Record<string, DatasetDefinition> = {
  'sabah-roads': {
    url: 'https://roadmaintenance.jkr.sabah.gov.my/arcmanager/rest/services/Hosted/Road_Section_public_view/FeatureServer/1',
    label: 'JKR Sabah public road sections',
    coverage: 'Sabah',
    regions: ['Sabah'],
    category: 'infrastructure',
    minZoom: 11,
    format: 'esri',
    outFields: 'objectid,road_name,district_name,road_length',
    description:
      'Official public road-section geometry for access and infrastructure context. Roads are not drainage pipes; unknown road-length attributes stay missing.',
  },
  'states-peninsular': {
    url: `${MYGEO}/5`,
    label: 'MyGeo state boundaries · Peninsular',
    coverage: 'Peninsular Malaysia',
    regions: PENINSULAR,
    category: 'environment',
    minZoom: 4,
    description:
      'Official MyGeoName state/territory reference boundaries. Source version fields retained; administrative context, not cadastral parcels.',
  },
  'states-borneo': {
    url: `${MYGEO}/6`,
    label: 'MyGeo state boundaries · Borneo',
    coverage: 'Sabah, Sarawak and Labuan',
    regions: ['Sabah', 'Sarawak', 'Labuan'],
    category: 'environment',
    minZoom: 4,
    description: 'Official Sabah, Sarawak and Labuan state/territory polygons.',
  },
  'districts-borneo': {
    url: `${MYGEO}/10`,
    label: 'MyGeo districts · East Malaysia',
    coverage: 'Sabah and Sarawak',
    regions: ['Sabah', 'Sarawak'],
    category: 'environment',
    minZoom: 8,
    description:
      'Official district reference boundaries, including published JTU source/version attributes.',
  },
  'divisions-borneo': {
    url: `${MYGEO}/9`,
    label: 'MyGeo divisions · East Malaysia',
    coverage: 'Sabah and Sarawak',
    regions: ['Sabah', 'Sarawak'],
    category: 'environment',
    minZoom: 7,
    description:
      'Official division polygons. Boundaries are published reference data, not a current legal-boundary certification.',
  },
  'national-river-polygons': {
    url: `${PLAN}/RFN4/04_PERANCANGAN_ALAM_SEKITAR/MapServer/14`,
    label: 'PLANMalaysia mapped river areas',
    coverage: 'Peninsular Malaysia, Sabah and Sarawak',
    regions: ['Malaysia'],
    category: 'environment',
    minZoom: 9,
    description:
      'Published river/water-area polygons including Borneo. Contextual water geometry, not drain dimensions or river discharge.',
  },
  'peninsular-landuse': {
    url: `${PLAN}/RFN4/02_GUNATANAH/MapServer/0`,
    label: 'PLANMalaysia land use · Peninsular',
    coverage: 'Peninsular Malaysia',
    regions: PENINSULAR,
    category: 'infrastructure',
    minZoom: 13,
    maxSpan: 0.2,
    description:
      'Published land-use polygons with category, hectare area and data year. Over six million source features; local viewport queries only. Land use is not a cadastral/valuation record.',
  },
  'peninsular-flood-prone': {
    url: `${PLAN}/RFN4/06_LAIN_LAIN_DATA_SOKONGAN/MapServer/78`,
    label: 'PLANMalaysia flood-prone areas',
    coverage: 'Peninsular source coverage; ARI unspecified',
    regions: PENINSULAR,
    category: 'flood',
    minZoom: 8,
    description:
      'Published Kawasan Mudah Banjir contextual polygons sourced from JPS website. Return period/date unspecified; not a calibrated inundation-depth prediction.',
  },
  'peninsular-reservoirs': {
    url: `${PLAN}/RFN4/03_INFRAUTILITI_01_UTILITI/MapServer/3`,
    label: 'PLANMalaysia dams & reservoirs',
    coverage: 'Peninsular source coverage',
    regions: PENINSULAR,
    category: 'infrastructure',
    minZoom: 7,
    description:
      'Published dam/reservoir polygons with name, status, area and use. No structural safety, storage capacity or live levels inferred.',
  },
  'labuan-reservoirs': {
    url: `${PLAN}/RFN4/03_INFRAUTILITI_01_UTILITI/MapServer/4`,
    label: 'PLANMalaysia reservoirs · Labuan',
    coverage: 'Labuan',
    regions: ['Labuan'],
    category: 'infrastructure',
    minZoom: 8,
    description: 'Two published Labuan reservoir polygons; source attributes retained.',
  },
  'sarawak-rivers': {
    url: `${SARAWAK}/SHARES/T735_RIVER/MapServer/0`,
    label: 'Sarawak official river network',
    coverage: 'Sarawak',
    regions: ['Sarawak'],
    category: 'environment',
    minZoom: 11,
    noPagination: true,
    maxSpan: 0.5,
    description:
      'State GIS river centrelines, RVTYPE/RVNAME/LENGTH. Published cartographic context; units/currency of raw length require confirmation, not a hydraulic network.',
  },
  'sarawak-water-features': {
    url: `${SARAWAK}/SHARES/T735_WATER_FEATURE/MapServer/0`,
    label: 'Sarawak official water features',
    coverage: 'Sarawak',
    regions: ['Sarawak'],
    category: 'infrastructure',
    minZoom: 10,
    type: 'point',
    noPagination: true,
    description: 'Official mapped water-feature points and published type/name attributes.',
  },
  'sarawak-landuse': {
    url: `${SARAWAK}/SHARES/T735_Landuse/MapServer/0`,
    label: 'Sarawak official land use',
    coverage: 'Sarawak',
    regions: ['Sarawak'],
    category: 'infrastructure',
    minZoom: 12,
    noPagination: true,
    maxSpan: 0.3,
    description:
      'State GIS land-use polygons, LUTYPE/LUNAME. Source currency is unspecified; land use is not a cadastral ownership certificate.',
  },
  'sarawak-canals': {
    url: `${SARAWAK}/mficord/irrigation_canal/FeatureServer/1`,
    label: 'Sarawak irrigation scheme canals',
    coverage: 'Published Sarawak irrigation scheme footprint',
    regions: ['Sarawak'],
    category: 'infrastructure',
    minZoom: 11,
    description:
      'Eleven published scheme canal lines near Batang Samarahan. Source water level/flow units unspecified; not a statewide complete drain inventory.',
  },
  'sarawak-storage-pond': {
    url: `${SARAWAK}/mficord/Storage_Pond/FeatureServer/1`,
    label: 'Sarawak scheme storage pond',
    coverage: 'Published Sarawak irrigation scheme footprint',
    regions: ['Sarawak'],
    category: 'infrastructure',
    minZoom: 11,
    description:
      'Published irrigation scheme storage pond polygon; no surveyed storage capacity inferred.',
  },
  'sarawak-soil-scheme': {
    url: `${SARAWAK}/mficord/Soil_Boundary/MapServer/1`,
    label: 'Sarawak scheme soil boundaries',
    coverage: 'Published Sarawak agricultural scheme footprint',
    regions: ['Sarawak'],
    category: 'environment',
    minZoom: 11,
    description:
      'Published soil-type/area/location polygons around agricultural schemes. No soil conductivity or tested infiltration rate inferred.',
  },
  'sarawak-paddy-lots': {
    url: `${SARAWAK}/mficord/Paddy_Lots/MapServer/1`,
    label: 'Sarawak agricultural scheme lots',
    coverage: 'Published Sarawak scheme footprint',
    regions: ['Sarawak'],
    category: 'infrastructure',
    minZoom: 12,
    maxSpan: 0.2,
    outFields: 'objectid,lot_no,project_name,soil_type,lot_area_ha,lot_status',
    description:
      'Published scheme lot boundaries and hectare areas. Owner/farmer attributes excluded. Partial scheme inventory, not national cadastral coverage.',
  },
  'sabah-geology': {
    url: `${GEOLOGY}/26`,
    label: 'JMG geology · Sabah',
    coverage: 'Sabah',
    regions: ['Sabah'],
    category: 'environment',
    minZoom: 9,
    description:
      'Official geological formation polygons, GLN/GFD/NAM. Bedrock geology is context, not measured topsoil infiltration or a geotechnical investigation.',
  },
  'sarawak-geology': {
    url: `${GEOLOGY}/28`,
    label: 'JMG geology · Sarawak',
    coverage: 'Sarawak',
    regions: ['Sarawak'],
    category: 'environment',
    minZoom: 9,
    description:
      'Official geological formation polygons. No soil permeability, contamination or structural bearing capacity inferred.',
  },
};
for (const dataset of Object.values(NATIONAL_DATASETS)) {
  if (dataset.url.startsWith(SARAWAK)) {
    dataset.availability = 'restricted';
    dataset.description = `Access rechecked 19 October 2026: provider requires a token. Historical public source catalogue only. ${dataset.description}`;
  }
}
export function datasetSupportsRegion(dataset: { regions: string[] }, region: string) {
  return (
    region === 'Malaysia' ||
    dataset.regions.includes('Malaysia') ||
    dataset.regions.includes(region)
  );
}
export function defaultWaterDataset(region: string) {
  return region === 'Labuan'
    ? 'labuan-reservoirs'
    : region === 'Klang / Selangor'
      ? 'drainage'
      : 'national-river-polygons';
}
export function floodDatasetAt(lng: number, lat: number) {
  if (lng >= 101.2 && lng <= 101.7 && lat >= 2.7 && lat <= 3.4) return 'flood-areas';
  return lng < 108 ? 'peninsular-flood-prone' : null;
}
