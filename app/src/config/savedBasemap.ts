import { BASEMAPS, type BasemapKey } from './basemaps';
export function getSavedBasemap(): BasemapKey {
  try {
    const saved = localStorage.getItem('hydrogrid-basemap');
    if (saved && Object.hasOwn(BASEMAPS, saved)) return saved as BasemapKey;
  } catch {
    return 'light';
  }
  return 'light';
}
