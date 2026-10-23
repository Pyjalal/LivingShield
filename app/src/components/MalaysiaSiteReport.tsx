import { useMemo } from 'react';
import type { FeatureCollection } from 'geojson';
import { useData } from '../malaysia/useData';
import type { Station } from '../malaysia/domain';
import { localTime, isFresh } from '../malaysia/domain';
import { haversineKm } from '../utils/hydrology';
import { useStationIDF } from '../malaysia/useIDF';
import { floodDatasetAt } from '../malaysia/catalogue';
import NationalSiteContext from './NationalSiteContext';
export default function MalaysiaSiteReport({
  lat,
  lng,
  address,
}: {
  lat: number;
  lng: number;
  address?: string;
  neighbourhood?: string;
}) {
  const idf = useStationIDF(lat, lng).station;
  const stations = useData<Station[]>('/api/stations');
  const nearby = useMemo(
    () =>
      (stations.result?.data ?? [])
        .map((s) => ({ ...s, distance: haversineKm(lat, lng, s.lat, s.lng) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3),
    [stations.result, lat, lng],
  );
  const floodId = floodDatasetAt(lng, lat);
  const flood = useData<FeatureCollection>(
    floodId
      ? `/api/gis?id=${floodId}&bbox=${lng - 0.000001},${lat - 0.000001},${lng + 0.000001},${lat + 0.000001}`
      : '',
  );
  return (
    <div className="sim-chart-card">
      <h4>Site Intelligence · {address}</h4>
      <div className="my-site-report-grid">
        <div>
          <strong>Malaysian agency flood context</strong>
          <p>
            {!floodId
              ? 'No verified open agency flood-area polygon source integrated for this location. Use the modelled scenario below for additional screening.'
              : flood.loading
                ? 'Checking geometry…'
                : flood.error
                  ? 'Source unavailable; risk unknown'
                  : flood.result?.data.features.length
                    ? `Site intersects a published ${floodId === 'flood-areas' ? 'MBDK' : 'PLANMalaysia'} flood-prone area.`
                    : 'No matching polygon in this source. This is not evidence of no flood risk.'}
          </p>
          <small>
            {floodId === 'flood-areas'
              ? 'MBDK Klang'
              : floodId
                ? 'PLANMalaysia / JPS source'
                : 'Agency coverage gap'}{' '}
            · ARI unspecified
          </small>
        </div>
        <div>
          <strong>Design rainfall profile</strong>
          <p>
            {idf
              ? `${idf.name} (${idf.id}), ${idf.state}`
              : 'Choose a published station or import approved coefficients.'}
          </p>
          <small>
            Selection requires local suitability review; not automatically derived from nearby
            gauges.
          </small>
        </div>
        <div>
          <strong>Nearest observed gauges</strong>
          {stations.error ? (
            <p>JPS source unavailable.</p>
          ) : (
            nearby.map((s) => (
              <p key={s.id}>
                {s.name} · {s.distance.toFixed(2)} km
                <br />
                {s.waterLevel ?? '—'} m ·{' '}
                {s.waterOnline && isFresh(s.waterAt) ? s.waterStatus : 'Not current'}
                <br />
                <small>{localTime(s.waterAt)} MYT</small>
              </p>
            ))
          )}
        </div>
      </div>
      <NationalSiteContext lat={lat} lng={lng} />
    </div>
  );
}
