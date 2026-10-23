import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useSettings, getRegion } from '../malaysia/settings';
export default function RegionFocus() {
  const settings = useSettings(),
    map = useMap();
  useEffect(() => {
    const region = getRegion();
    map.setView([region.lat, region.lng], region.zoom);
  }, [settings.region, map]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}
