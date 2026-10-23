import { useState } from 'react';
import { BASEMAPS, type BasemapKey } from '../config/basemaps';

export default function BasemapSwitcher({
  active,
  onChange,
  automatic = false,
  onAutomatic,
}: {
  active: BasemapKey;
  onChange: (key: BasemapKey) => void;
  automatic?: boolean;
  onAutomatic?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const select = (key: BasemapKey) => {
    onChange(key);
    setExpanded(false);
  };

  return (
    <div
      className="basemap-switcher"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setExpanded(false);
      }}
    >
      <button
        className="basemap-toggle"
        onClick={() => setExpanded(!expanded)}
        title="Change map style"
        aria-label={`Change map style, current ${BASEMAPS[active].label}`}
        aria-expanded={expanded}
      >
        <span className="basemap-preview-mini" data-basemap={active} aria-hidden="true" />
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      </button>
      {expanded && (
        <div className="basemap-menu" role="group" aria-label="Map styles">
          {onAutomatic && (
            <button
              className={`basemap-option ${automatic ? 'active' : ''}`}
              aria-pressed={automatic}
              onClick={() => {
                onAutomatic();
                setExpanded(false);
              }}
            >
              Follow app theme
            </button>
          )}
          {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
            <button
              key={key}
              className={`basemap-option ${key === active ? 'active' : ''}`}
              aria-pressed={key === active}
              onClick={() => select(key)}
            >
              <span className="basemap-preview" data-basemap={key} aria-hidden="true" />
              <span>{BASEMAPS[key].label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
