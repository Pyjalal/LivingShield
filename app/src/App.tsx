import { useEffect, useState, useRef, lazy, Suspense, useCallback } from 'react';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import PropertyToolsView from './components/PropertyToolsView';
import { useMapData } from './hooks/useMapData';
import { downloadPNG } from './utils/export';
import logoSvg from './assets/livingshield.svg';
import { BRAND_NAME } from './brand';
import { UiThemeContext } from './config/appearance';
import GuidedDemo from './platform/GuidedDemo';
import type { PlatformView, FloodEvidence, BankEvidence } from './platform/evidence';
import './platform/platform.css';
import './App.css';
import MalaysiaControls from './components/MalaysiaControls';
import './malaysia/original.css';

const PrecipitationView = lazy(() => import('./components/PrecipitationView'));
const HydrometricView = lazy(() => import('./components/HydrometricView'));
const EngineeringView = lazy(() => import('./components/EngineeringView'));
const StormSimulationView = lazy(() => import('./components/StormSimulationView'));
const CostAnalysisView = lazy(() => import('./components/CostAnalysisView'));
const DrainageWaterView = lazy(() => import('./components/DrainageWaterView'));
const TownshipView = lazy(() => import('./township/TownshipView'));
const LandingPage = lazy(() => import('./landing/LandingPage'));
const LivingShieldView = lazy(() => import('./livingshield/LivingShieldView'));
const EvidenceView = lazy(() => import('./platform/EvidenceView'));
type ActiveView = PlatformView;
type FloodSubView = 'flood' | 'hydrometric' | 'precipitation';
type EngSubView = 'engineering' | 'simulation' | 'cost';
type UiTheme = 'terminal' | 'dark' | 'accessible';

const FLOOD_SUB_OPTIONS: { key: FloodSubView; label: string }[] = [
  { key: 'flood', label: 'Flood Hazard' },
  { key: 'hydrometric', label: 'River Flow' },
  { key: 'precipitation', label: 'Precipitation Explorer' },
];

const ENG_SUB_OPTIONS: { key: EngSubView; label: string }[] = [
  { key: 'engineering', label: 'Drainage Design' },
  { key: 'simulation', label: 'Storm Simulation' },
  { key: 'cost', label: 'Cost Analysis' },
];

const LS_THEME_KEY = 'hydrogrid-ui-theme';
const SCALE_OPTIONS = [80, 90, 100, 110, 120, 130, 140];

function getAutoScale(): number {
  return 100;
}

export default function App() {
  const { layers, toggleLayer, loadVisibleLayers, onMapMove } = useMapData();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [townshipId, setTownshipId] = useState('bukit-raja');
  const [floodByTownship, setFloodByTownship] = useState<Record<string, FloodEvidence>>({});
  const [bankByTownship, setBankByTownship] = useState<Record<string, BankEvidence>>({});
  const floodEvidence = floodByTownship[townshipId] ?? null;
  const bankEvidence = bankByTownship[townshipId] ?? null;
  const saveFloodEvidence = useCallback((value: FloodEvidence) => {
    setFloodByTownship((previous) => ({ ...previous, [value.townshipId]: value }));
  }, []);
  const saveBankEvidence = useCallback((value: BankEvidence) => {
    setBankByTownship((previous) => ({ ...previous, [value.townshipId]: value }));
  }, []);
  const [demoStep, setDemoStep] = useState<number | null>(null);
  const [floodDropdownOpen, setFloodDropdownOpen] = useState(false);
  const [engDropdownOpen, setEngDropdownOpen] = useState(false);
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
    try {
      const saved = localStorage.getItem(LS_THEME_KEY);
      return saved === 'dark' || saved === 'terminal' || saved === 'accessible'
        ? saved
        : 'accessible';
    } catch {
      return 'accessible';
    }
  });
  const [uiScale, setUiScale] = useState(getAutoScale);
  const [scaleManual, setScaleManual] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const scaleRef = useRef<HTMLDivElement>(null);
  const floodDropdownRef = useRef<HTMLDivElement>(null);
  const engDropdownRef = useRef<HTMLDivElement>(null);

  const THEME_CYCLE: UiTheme[] = ['accessible', 'dark', 'terminal'];
  const THEME_LABELS: Record<UiTheme, string> = {
    terminal: 'High contrast',
    dark: 'Dark',
    accessible: 'Light',
  };

  function cycleUiTheme() {
    const idx = THEME_CYCLE.indexOf(uiTheme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setUiTheme(next);
    try {
      localStorage.setItem(LS_THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function changeScale(s: number) {
    setUiScale(s);
    setScaleManual(true);
    setScaleOpen(false);
  }

  function resetAutoScale() {
    setScaleManual(false);
    setUiScale(getAutoScale());
    setScaleOpen(false);
  }

  useEffect(() => {
    if (scaleManual) return;
    function onResize() {
      setUiScale(getAutoScale());
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [scaleManual]);

  const handleExport = useCallback(() => {
    const app = document.querySelector('.app') as HTMLElement | null;
    if (app) downloadPNG(app, `${BRAND_NAME}_${activeView}.png`);
  }, [activeView]);

  useEffect(() => {
    loadVisibleLayers();
  }, [loadVisibleLayers]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (floodDropdownRef.current && !floodDropdownRef.current.contains(e.target as Node)) {
        setFloodDropdownOpen(false);
      }
      if (engDropdownRef.current && !engDropdownRef.current.contains(e.target as Node)) {
        setEngDropdownOpen(false);
      }
      if (scaleRef.current && !scaleRef.current.contains(e.target as Node)) {
        setScaleOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isFloodView =
    activeView === 'flood' || activeView === 'hydrometric' || activeView === 'precipitation';
  const activeFloodLabel =
    FLOOD_SUB_OPTIONS.find((o) => o.key === activeView)?.label ?? 'Flood Hazard';

  const isEngView =
    activeView === 'engineering' || activeView === 'simulation' || activeView === 'cost';
  const activeEngLabel =
    ENG_SUB_OPTIONS.find((o) => o.key === activeView)?.label ?? 'Site Analysis';

  function selectFloodSub(key: FloodSubView) {
    setActiveView(key);
    setFloodDropdownOpen(false);
  }

  function selectEngSub(key: EngSubView) {
    setActiveView(key);
    setEngDropdownOpen(false);
  }

  return (
    <UiThemeContext.Provider value={uiTheme}>
      <div
        className="app"
        data-view={activeView}
        data-ui-theme={uiTheme}
        style={
          {
            '--ui-scale': uiScale / 100,
          } as React.CSSProperties
        }
      >
        <nav className="tab-bar">
          <button
            className="tab-brand"
            onClick={() => setActiveView('home')}
            aria-label="LivingShield home"
          >
            <img src={logoSvg} alt="" width="22" height="22" className="tab-logo" />
            {BRAND_NAME}
          </button>

          <div className="tab-buttons">
            <button
              className={`tab-btn ${activeView === 'township' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('township');
                setFloodDropdownOpen(false);
                setEngDropdownOpen(false);
              }}
            >
              ◇ 3D Townships
            </button>
            <button
              className={`tab-btn ${activeView === 'living-shield' ? 'active' : ''}`}
              onClick={() => setActiveView('living-shield')}
            >
              △ River Lab
            </button>
            <button
              className={`tab-btn ${activeView === 'evidence' ? 'active' : ''}`}
              onClick={() => setActiveView('evidence')}
            >
              ↗ Evidence brief
            </button>
            {/* Map Layers — simple tab */}
            <button
              className={`tab-btn ${activeView === 'layers' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('layers');
                setFloodDropdownOpen(false);
                setEngDropdownOpen(false);
              }}
            >
              <svg
                width="16"
                height="16"
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
              National Maps
            </button>

            {/* Drainage & Water tab */}
            <button
              className={`tab-btn ${activeView === 'drainage' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('drainage');
                setFloodDropdownOpen(false);
                setEngDropdownOpen(false);
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 16c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" />
                <path d="M2 12c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" />
                <path d="M12 2v6" />
                <path d="M9 5l3-3 3 3" />
              </svg>
              Drainage &amp; Water
            </button>

            {/* Flood Hazard dropdown */}
            <div className="tab-dropdown-wrap" ref={floodDropdownRef}>
              <button
                className={`tab-btn ${isFloodView ? 'active' : ''}`}
                onClick={() => {
                  setEngDropdownOpen(false);
                  if (!isFloodView) {
                    setActiveView('flood');
                  }
                  setFloodDropdownOpen((p) => !p);
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
                  <path d="M8 16l-2.3 2.3" />
                  <path d="M12 12l-2.3 2.3" />
                  <path d="M16 16l-2.3 2.3" />
                  <path d="M12 20l-2.3 2.3" />
                </svg>
                {isFloodView ? activeFloodLabel : 'Flood Hazard'}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`tab-chevron ${floodDropdownOpen ? 'open' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {floodDropdownOpen && (
                <div className="tab-dropdown">
                  {FLOOD_SUB_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      className={`tab-dropdown-item ${activeView === opt.key ? 'active' : ''}`}
                      onClick={() => selectFloodSub(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className={`tab-btn ${activeView === 'property' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('property');
                setFloodDropdownOpen(false);
                setEngDropdownOpen(false);
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="9" y1="6" x2="9" y2="6.01" />
                <line x1="15" y1="6" x2="15" y2="6.01" />
                <line x1="9" y1="10" x2="9" y2="10.01" />
                <line x1="15" y1="10" x2="15" y2="10.01" />
                <line x1="9" y1="14" x2="9" y2="14.01" />
                <line x1="15" y1="14" x2="15" y2="14.01" />
                <line x1="9" y1="18" x2="15" y2="18" />
              </svg>
              Property Lookup
            </button>

            {/* Site Analysis dropdown */}
            <div className="tab-dropdown-wrap" ref={engDropdownRef}>
              <button
                className={`tab-btn ${isEngView ? 'active' : ''}`}
                onClick={() => {
                  setFloodDropdownOpen(false);
                  if (!isEngView) {
                    setActiveView('engineering');
                  }
                  setEngDropdownOpen((p) => !p);
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 16c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" />
                  <path d="M2 12c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" />
                  <path d="M12 2v6" />
                  <path d="M9 5l3-3 3 3" />
                </svg>
                {isEngView ? activeEngLabel : 'Site Analysis'}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`tab-chevron ${engDropdownOpen ? 'open' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {engDropdownOpen && (
                <div className="tab-dropdown">
                  {ENG_SUB_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      className={`tab-dropdown-item ${activeView === opt.key ? 'active' : ''}`}
                      onClick={() => selectEngSub(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className="tab-theme-btn tab-export-btn"
              onClick={handleExport}
              title="Export current view as PNG"
              style={{ marginLeft: 'auto' }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>

            <div className="tab-dropdown-wrap tab-scale-wrap" ref={scaleRef}>
              <button
                className="tab-theme-btn"
                onClick={() => setScaleOpen((o) => !o)}
                title="UI Scale"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              {scaleOpen && (
                <div className="tab-dropdown">
                  <button
                    className={`tab-dropdown-item ${!scaleManual ? 'active' : ''}`}
                    onClick={resetAutoScale}
                  >
                    Auto ({getAutoScale()}%)
                  </button>
                  {SCALE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      className={`tab-dropdown-item ${scaleManual && uiScale === s ? 'active' : ''}`}
                      onClick={() => changeScale(s)}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className="tab-theme-btn tab-theme-cycle"
              onClick={cycleUiTheme}
              title="Cycle theme"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              {THEME_LABELS[uiTheme]}
            </button>
          </div>
        </nav>

        {demoStep !== null && (
          <GuidedDemo
            step={demoStep}
            activeView={activeView}
            flood={floodEvidence}
            bank={bankEvidence}
            onStep={(step, view) => {
              setDemoStep(step);
              setActiveView(view);
            }}
            onClose={() => setDemoStep(null)}
          />
        )}
        {!['home', 'township', 'living-shield', 'evidence'].includes(activeView) && (
          <MalaysiaControls />
        )}
        <div className="app-content">
          {activeView === 'home' && (
            <Suspense
              fallback={<div className="precip-overlay-loading">Loading LivingShield…</div>}
            >
              <LandingPage
                onOpen={setActiveView}
                onStartDemo={() => {
                  setDemoStep(0);
                  setActiveView('township');
                }}
              />
            </Suspense>
          )}
          {activeView === 'living-shield' && (
            <Suspense fallback={<div className="precip-overlay-loading">Loading River Lab…</div>}>
              <LivingShieldView
                key={townshipId}
                uiTheme={uiTheme}
                townshipId={townshipId}
                onTownshipChange={setTownshipId}
                initialInputs={bankEvidence?.inputs}
                onOpenTownship={(id) => {
                  setTownshipId(id);
                  setActiveView('township');
                }}
                onPlanChange={saveBankEvidence}
              />
            </Suspense>
          )}
          {activeView === 'evidence' && (
            <Suspense
              fallback={<div className="precip-overlay-loading">Loading evidence brief…</div>}
            >
              <EvidenceView
                townshipId={townshipId}
                onTownshipChange={setTownshipId}
                flood={floodEvidence}
                bank={bankEvidence}
                onOpen={setActiveView}
              />
            </Suspense>
          )}
          {activeView === 'township' && (
            <Suspense
              fallback={<div className="precip-overlay-loading">Loading township planner…</div>}
            >
              <TownshipView
                uiTheme={uiTheme}
                townshipId={townshipId}
                onTownshipChange={setTownshipId}
                onRiverLab={(id) => {
                  setTownshipId(id);
                  setActiveView('living-shield');
                }}
                initialFlood={floodEvidence}
                onFloodResult={saveFloodEvidence}
                onEngineering={() => setActiveView('engineering')}
              />
            </Suspense>
          )}
          {activeView === 'layers' && (
            <>
              <Sidebar
                layers={layers}
                onToggle={toggleLayer}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                categoryFilter={['infrastructure', 'environment', 'precipitation', 'energy']}
              />
              {!sidebarOpen && (
                <button
                  className="sidebar-open-btn"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open sidebar"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              )}
              <MapView layers={layers} onMapMove={onMapMove} sidebarOpen={sidebarOpen} />
            </>
          )}
          {activeView === 'flood' && (
            <>
              <Sidebar
                layers={layers}
                onToggle={toggleLayer}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                categoryFilter={['flood']}
              />
              {!sidebarOpen && (
                <button
                  className="sidebar-open-btn"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open sidebar"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              )}
              <MapView layers={layers} onMapMove={onMapMove} sidebarOpen={sidebarOpen} />
            </>
          )}
          {activeView === 'hydrometric' && (
            <Suspense fallback={<div className="precip-overlay-loading">Loading...</div>}>
              <HydrometricView />
            </Suspense>
          )}
          {activeView === 'precipitation' && (
            <Suspense fallback={<div className="precip-overlay-loading">Loading...</div>}>
              <PrecipitationView />
            </Suspense>
          )}
          {activeView === 'drainage' && (
            <Suspense fallback={<div className="precip-overlay-loading">Loading...</div>}>
              <DrainageWaterView />
            </Suspense>
          )}
          {activeView === 'property' && <PropertyToolsView />}
          {activeView === 'engineering' && (
            <Suspense fallback={<div className="precip-overlay-loading">Loading...</div>}>
              <EngineeringView />
            </Suspense>
          )}
          {activeView === 'simulation' && (
            <Suspense fallback={<div className="precip-overlay-loading">Loading...</div>}>
              <StormSimulationView />
            </Suspense>
          )}
          {activeView === 'cost' && (
            <Suspense fallback={<div className="precip-overlay-loading">Loading...</div>}>
              <CostAnalysisView />
            </Suspense>
          )}
        </div>
      </div>
    </UiThemeContext.Provider>
  );
}
