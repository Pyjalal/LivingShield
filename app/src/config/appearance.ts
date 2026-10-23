import { createContext, useContext, useSyncExternalStore } from 'react';
import { BASEMAPS, type BasemapKey } from './basemaps';

export const UiThemeContext = createContext<'accessible' | 'dark' | 'terminal'>('accessible');
const EVENT = 'livingshield:basemap';
const KEY = 'hydrogrid-basemap';
type Preference = BasemapKey | 'auto';
let fallback: Preference = 'auto';
let persistenceFailed = false;

function snapshot(): Preference {
  if (persistenceFailed) return fallback;
  try {
    const saved = localStorage.getItem(KEY);
    return saved && Object.hasOwn(BASEMAPS, saved) ? (saved as BasemapKey) : 'auto';
  } catch {
    return fallback;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}
function choose(preference: Preference) {
  fallback = preference;
  try {
    if (preference === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, preference);
    persistenceFailed = false;
  } catch {
    persistenceFailed = true;
  }
  window.dispatchEvent(new Event(EVENT));
}
export function useBasemap() {
  const theme = useContext(UiThemeContext);
  const preference = useSyncExternalStore(subscribe, snapshot);
  return {
    basemap: preference === 'auto' ? (theme === 'accessible' ? 'light' : 'dark') : preference,
    automatic: preference === 'auto',
    choose,
  };
}
