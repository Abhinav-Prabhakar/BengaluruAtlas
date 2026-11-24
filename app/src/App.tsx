import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crosshair,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CATEGORIES,
  MODE_BY_ID,
  TIME_STOPS,
} from './lib/catalog';
import {
  distanceKm,
  estimateMinutes,
  formatCount,
  nearestArea,
  reachKm,
} from './lib/geo';
import {
  buildPlaceIndex,
  placeForTrailStop,
  placeHaystack,
  resolvePlaceId,
} from './lib/places';
import {
  readTheme,
  readSaved,
  readVisited,
  writeSaved,
  writeVisited,
  writeTheme,
} from './lib/storage';
import type {
  Atlas,
  CategoryId,
  Origin,
  Place,
  ResultRow,
  TabId,
  Theme,
  Trail,
  TravelMode,
} from './lib/types';
import { buildQueryString, buildShareUrl, readInitialState } from './lib/url';
import About from './components/About';
import { AtlasMark } from './components/Brand';
import DetailPanel from './components/DetailPanel';
import FilterPanel from './components/FilterPanel';
import MapCanvas from './components/MapCanvas';
import Modal from './components/Modal';
import PlacesPanel from './components/PlacesPanel';
import SavedPanel from './components/SavedPanel';
import TabBar from './components/TabBar';
import Topbar from './components/Topbar';
import TrailsPanel from './components/TrailsPanel';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(area);
      return copied;
    } catch {
      return false;
    }
  }
}

function LoadingScreen() {
  return (
    <div className="boot-screen">
      <div className="boot-mark">
        <AtlasMark />
      </div>
      <p className="eyebrow">A field guide to the city</p>
      <h1>Bengaluru Atlas</h1>
      <p className="boot-line">Pulling the city into focus…</p>
      <div className="boot-bar" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}

export default function App() {
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetch(`${import.meta.env.BASE_URL}data/atlas.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Atlas data returned ${response.status}`);
        return response.json() as Promise<Atlas>;
      })
      .then((data) => {
        if (alive) setAtlas(data);
      })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : 'Unknown error');
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (error) {
    return (
      <div className="boot-screen is-error">
        <div className="boot-mark">
          <AtlasMark />
        </div>
        <p className="eyebrow">The atlas is out of reach</p>
        <h1>Could not load the city.</h1>
        <p className="boot-line">
          The data file did not arrive. Check the connection and try again.
        </p>
        <button
          type="button"
          className="button button-primary"
          onClick={() => setAttempt((value) => value + 1)}
        >
          <RotateCcw size={14} />
          Try again
        </button>
        <p className="boot-error">{error}</p>
      </div>
    );
  }

  if (!atlas) return <LoadingScreen />;
  return <AtlasExperience atlas={atlas} />;
}

function AtlasExperience({ atlas }: { atlas: Atlas }) {
  const places = useMemo(() => buildPlaceIndex(atlas), [atlas]);
  const initial = useMemo(() => readInitialState(atlas, places), [atlas, places]);
  const isMobile = useMediaQuery('(max-width: 899px)');

  const [origin, setOrigin] = useState<Origin>(initial.origin);
  const [categories, setCategories] = useState<CategoryId[]>(initial.categories);
  const [mode, setMode] = useState<TravelMode>(initial.mode);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [query, setQuery] = useState(initial.query);
  const [tab, setTab] = useState<TabId>(initial.trail ? 'trails' : 'places');
  const [selected, setSelected] = useState<Place | null>(initial.place);
  const [trailId, setTrailId] = useState<string | null>(initial.trail?.id ?? null);
  const [theme, setTheme] = useState<Theme>(
    () =>
      readTheme() ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  const [saved, setSaved] = useState<Set<string>>(() => readSaved());
  const [visited, setVisited] = useState<Set<string>>(() => readVisited());
  const [pickMode, setPickMode] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(48);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const radiusKm = useMemo(() => reachKm(mode, minutes), [mode, minutes]);
  const trail = useMemo(
    () => atlas.trails.find((candidate) => candidate.id === trailId) || null,
    [atlas.trails, trailId],
  );

  const haystacks = useMemo(
    () => new Map(atlas.places.map((place) => [place.id, placeHaystack(place)])),
    [atlas.places],
  );

  const { rows, counts, totalWithin } = useMemo(() => {
    const nextCounts = Object.fromEntries(
      CATEGORIES.map((category) => [category.id, 0]),
    ) as Record<CategoryId, number>;
    const needle = query.trim().toLowerCase();
    const inRange: ResultRow[] = [];

    for (const place of atlas.places) {
      const km = distanceKm(origin, place);
      if (km > radiusKm) continue;
      if (needle && !(haystacks.get(place.id) || '').includes(needle)) continue;
      nextCounts[place.cat] += 1;
      inRange.push({
        place,
        distanceKm: km,
        minutes: estimateMinutes(km, mode),
      });
    }

    const filtered =
      categories.length > 0
        ? inRange.filter((row) => categories.includes(row.place.cat))
        : inRange;

    filtered.sort(
      (a, b) =>
        b.place.score - a.place.score || a.distanceKm - b.distanceKm,
    );

    return {
      rows: filtered,
      counts: nextCounts,
      totalWithin: inRange.length,
    };
  }, [atlas.places, origin, radiusKm, mode, query, categories, haystacks]);

  const visibleRows = useMemo(
    () => rows.slice(0, visibleCount),
    [rows, visibleCount],
  );

  const selectedRow = useMemo<ResultRow | null>(() => {
    if (!selected) return null;
    const km = distanceKm(origin, selected);
    return {
      place: selected,
      distanceKm: km,
      minutes: estimateMinutes(km, mode),
    };
  }, [selected, origin, mode]);

  const savedRows = useMemo(() => {
    const out: ResultRow[] = [];
    for (const id of saved) {
      const place = resolvePlaceId(atlas, places, id);
      if (!place) continue;
      const km = distanceKm(origin, place);
      out.push({ place, distanceKm: km, minutes: estimateMinutes(km, mode) });
    }
    return out;
  }, [saved, atlas, places, origin, mode]);

  const visitedRows = useMemo(() => {
    const out: ResultRow[] = [];
    for (const id of visited) {
      const place = resolvePlaceId(atlas, places, id);
      if (!place) continue;
      const km = distanceKm(origin, place);
      out.push({ place, distanceKm: km, minutes: estimateMinutes(km, mode) });
    }
    return out;
  }, [visited, atlas, places, origin, mode]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeTheme(theme);
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) =>
        meta.setAttribute('content', theme === 'dark' ? '#0E100C' : '#F3EDE2'),
      );
  }, [theme]);

  useEffect(() => {
    writeSaved(saved);
  }, [saved]);

  useEffect(() => {
    writeVisited(visited);
  }, [visited]);

  useEffect(() => {
    setVisibleCount(48);
  }, [origin, categories, mode, minutes, query]);

  useEffect(() => {
    if (!isMobile) setMobileFilters(false);
  }, [isMobile]);

  useEffect(() => {
    document.title = selected
      ? `${selected.name} · Bengaluru Atlas`
      : 'Bengaluru Atlas — a field guide to the city';
  }, [selected]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const queryString = buildQueryString({
      origin,
      categories,
      mode,
      minutes,
      query,
      placeId: selected?.id ?? null,
      trailId,
    });
    const next = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
    window.history.replaceState(null, '', next);
  }, [origin, categories, mode, minutes, query, selected, trailId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (aboutOpen) {
        setAboutOpen(false);
      } else if (mobileFilters) {
        setMobileFilters(false);
      } else if (pickMode) {
        setPickMode(false);
        setToast('Map picking cancelled.');
      } else if (selected) {
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aboutOpen, mobileFilters, pickMode, selected]);

  const currentQuery = () =>
    buildShareUrl({
      origin,
      categories,
      mode,
      minutes,
      query,
      placeId: selected?.id ?? null,
      trailId,
    });

  const handleShare = async () => {
    const copied = await copyText(currentQuery());
    setToast(
      copied
        ? 'Link copied — filters, place and all.'
        : 'Could not copy the link. Try the address bar.',
    );
  };

  const handleToggleTheme = () => {
    setTheme((value) => (value === 'dark' ? 'light' : 'dark'));
  };

  const handleSelectArea = (area: Atlas['areas'][number]) => {
    setOrigin({
      id: area.id,
      name: area.name,
      lat: area.lat,
      lon: area.lon,
      kind: 'area',
      areaId: area.id,
    });
    setSelected(null);
    setTrailId(null);
    setTab('places');
    setPickMode(false);
  };

  const handleNearMe = () => {
    if (!('geolocation' in navigator)) {
      setToast('Location is not available in this browser.');
      return;
    }
    setToast('Finding your corner of the city…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        const fromCity = distanceKm(point, { lat: 12.9716, lon: 77.5946 });
        if (fromCity > 150) {
          setToast('You are far outside Bengaluru — pick a neighbourhood instead.');
          return;
        }
        const near = nearestArea(atlas.areas, point);
        setOrigin({
          id: 'geo',
          name: `Your location · ${near.name}`,
          lat: point.lat,
          lon: point.lon,
          kind: 'geo',
        });
        setSelected(null);
        setTrailId(null);
        setTab('places');
        setPickMode(false);
        setMobileFilters(false);
        setToast(`Starting near ${near.name}.`);
      },
      () => {
        setToast('Could not get your location — pick a neighbourhood instead.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handlePickMap = () => {
    setPickMode(true);
    setSelected(null);
    setTrailId(null);
    setTab('places');
    setMobileFilters(false);
    setSheetExpanded(false);
    setToast('Tap the map to set your starting point.');
  };

  const handlePick = (point: { lat: number; lon: number }) => {
    const near = nearestArea(atlas.areas, point);
    setOrigin({
      id: 'pin',
      name: `Near ${near.name}`,
      lat: point.lat,
      lon: point.lon,
      kind: 'pin',
    });
    setPickMode(false);
    setSelected(null);
    setTrailId(null);
    setTab('places');
    setToast(`Start moved to a pinned point near ${near.name}.`);
  };

  const handleToggleCategory = (category: CategoryId) => {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  };

  const handleTab = (next: TabId) => {
    setTab(next);
    setSelected(null);
    setPickMode(false);
    if (next !== 'trails') setTrailId(null);
    if (next !== 'places') setSheetExpanded(true);
  };

  const handleSelectTrail = (nextTrail: Trail) => {
    setTrailId(nextTrail.id);
    setSelected(null);
    setTab('trails');
    setSheetExpanded(true);
  };

  const handleClearTrail = () => {
    setTrailId(null);
    setSelected(null);
    setTab('trails');
  };

  const handleSelectStop = (nextTrail: Trail, stopIndex: number) => {
    const stop = nextTrail.stops[stopIndex];
    if (!stop) return;
    setSelected(placeForTrailStop(nextTrail, stop, stopIndex, atlas, places));
    setTrailId(nextTrail.id);
    setTab('trails');
  };

  const handleToggleSave = (place: Place) => {
    const wasSaved = saved.has(place.id);
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(place.id)) next.delete(place.id);
      else next.add(place.id);
      return next;
    });
    setToast(wasSaved ? 'Removed from your saved places.' : 'Saved to your field notes.');
  };

  const handleToggleVisited = (place: Place) => {
    const wasVisited = visited.has(place.id);
    setVisited((current) => {
      const next = new Set(current);
      if (next.has(place.id)) next.delete(place.id);
      else next.add(place.id);
      return next;
    });
    setToast(wasVisited ? 'Visited mark removed.' : 'Marked as visited.');
  };

  const handleSurprise = () => {
    const unvisited = rows.filter(
      (row) => !visited.has(row.place.id) && row.place.id !== selected?.id,
    );
    const pool = unvisited.length ? unvisited : rows;
    const picks = pool.filter(
      (row) => row.place.curated || row.place.gem || row.place.score >= 45,
    );
    const source = picks.length ? picks : pool;
    if (!source.length) {
      setToast('Nothing in reach — widen the window or clear a filter first.');
      return;
    }
    const pick = source[Math.floor(Math.random() * source.length)];
    setSelected(pick.place);
    setTrailId(null);
    setTab('places');
    setSheetExpanded(true);
  };

  const handleHome = () => {
    const home = atlas.areas.find((area) => area.id === 'mg-road') || atlas.areas[0];
    setOrigin({
      id: home.id,
      name: home.name,
      lat: home.lat,
      lon: home.lon,
      kind: 'area',
      areaId: home.id,
    });
    setCategories([]);
    setMode('auto');
    setMinutes(15);
    setQuery('');
    setSelected(null);
    setTrailId(null);
    setTab('places');
    setPickMode(false);
    setMobileFilters(false);
    setSheetExpanded(false);
  };

  const widenWindow = () => {
    const next = TIME_STOPS.find((stop) => stop > minutes) ?? minutes;
    setMinutes(next);
  };

  const filterProps = {
    areas: atlas.areas,
    origin,
    categories,
    mode,
    minutes,
    radiusKm,
    counts,
    totalWithin,
    theme,
    onSelectArea: handleSelectArea,
    onNearMe: handleNearMe,
    onPickMap: handlePickMap,
    onToggleCategory: handleToggleCategory,
    onClearCategories: () => setCategories([]),
    onMode: setMode,
    onMinutes: setMinutes,
  };

  const placesPanel = (
    <PlacesPanel
      rows={visibleRows}
      total={rows.length}
      shown={visibleRows.length}
      query={query}
      theme={theme}
      saved={saved}
      visited={visited}
      selectedId={selected?.id ?? null}
      categoriesActive={categories.length > 0}
      canWiden={minutes < TIME_STOPS[TIME_STOPS.length - 1]}
      onQuery={setQuery}
      onSelect={(row) => setSelected(row.place)}
      onToggleSave={handleToggleSave}
      onShowMore={() => setVisibleCount((value) => value + 48)}
      onClearCategories={() => setCategories([])}
      onWiden={widenWindow}
      onOpenFilters={() => setMobileFilters(true)}
    />
  );

  const tabBar = (
    <TabBar
      tab={tab}
      onTab={handleTab}
      placesCount={totalWithin}
      trailsCount={atlas.trails.length}
      savedCount={saved.size}
    />
  );

  const trailPanel = (
    <TrailsPanel
      trails={atlas.trails}
      activeTrail={trail}
      theme={theme}
      onSelectTrail={handleSelectTrail}
      onClearTrail={handleClearTrail}
      onSelectStop={(nextTrail, _stop, index) => handleSelectStop(nextTrail, index)}
    />
  );

  const savedPanel = (
    <SavedPanel
      savedRows={savedRows}
      visitedRows={visitedRows}
      selectedId={selected?.id ?? null}
      theme={theme}
      onSelect={(row) => setSelected(row.place)}
      onToggleSave={(row) => handleToggleSave(row.place)}
      onGoPlaces={() => handleTab('places')}
      onSurprise={handleSurprise}
    />
  );

  return (
    <div className="app">
      <Topbar
        theme={theme}
        onTheme={handleToggleTheme}
        onShare={handleShare}
        onAbout={() => setAboutOpen(true)}
        onSurprise={handleSurprise}
        onHome={handleHome}
      />

      <main className="workspace">
        {!isMobile && (
          <aside className="rail">
            <div className="rail-scroll">
              <FilterPanel {...filterProps} />
              {tabBar}
              <div className="rail-content">
                {tab === 'places' && placesPanel}
                {tab === 'trails' && trailPanel}
                {tab === 'saved' && savedPanel}
              </div>
              <footer className="rail-footer">
                <span>
                  © OpenStreetMap · OpenFreeMap · {formatCount(atlas.meta.total)} places
                </span>
                <button type="button" className="text-button" onClick={() => setAboutOpen(true)}>
                  Data & credits
                </button>
              </footer>
            </div>
          </aside>
        )}

        <section className="map-stage">
          <MapCanvas
            results={rows}
            areas={atlas.areas}
            origin={origin}
            radiusKm={radiusKm}
            selected={selected}
            trail={trail}
            theme={theme}
            pickMode={pickMode}
            onSelectPlace={setSelected}
            onSelectArea={handleSelectArea}
            onSelectTrailStop={(nextTrail, _stop, index) =>
              handleSelectStop(nextTrail, index)
            }
            onPick={handlePick}
          />

          <div className="map-caption">
            <p className="eyebrow">
              {trail ? 'Trail on the map' : 'Bengaluru · in reach'}
            </p>
            <strong>
              {trail
                ? trail.title
                : `${formatCount(totalWithin)} places within ${minutes} min`}
            </strong>
            <span>
              {trail
                ? `${trail.kind === 'daytrip' ? 'Day trip' : 'Walk'} · ${trail.distance} · ${trail.duration}`
                : `${MODE_BY_ID[mode].label} from ${origin.name} · ≈ ${radiusKm < 1 ? `${Math.round(radiusKm * 1000)} m` : `${radiusKm.toFixed(1)} km`} radius`}
            </span>
          </div>

          <button type="button" className="surprise-fab" onClick={handleSurprise}>
            <Shuffle size={15} />
            Surprise me
          </button>

          {pickMode && (
            <div className="pick-banner" role="status">
              <Crosshair size={18} />
              <div>
                <strong>Set your start</strong>
                <span>Tap anywhere on the map.</span>
              </div>
              <button type="button" onClick={() => setPickMode(false)}>
                Cancel
              </button>
            </div>
          )}

          {selected && selectedRow && (
            <DetailPanel
              place={selected}
              theme={theme}
              mode={mode}
              originName={origin.name}
              distanceKm={selectedRow.distanceKm}
              minutes={selectedRow.minutes}
              saved={saved.has(selected.id)}
              visited={visited.has(selected.id)}
              onClose={() => setSelected(null)}
              onToggleSave={() => handleToggleSave(selected)}
              onToggleVisited={() => handleToggleVisited(selected)}
              onShare={handleShare}
            />
          )}
        </section>
      </main>

      {isMobile && (
        <section className={`mobile-panel ${sheetExpanded ? 'is-expanded' : ''}`}>
          <button
            type="button"
            className="sheet-grip"
            onClick={() => setSheetExpanded((value) => !value)}
            aria-label={sheetExpanded ? 'Collapse the panel' : 'Expand the panel'}
          >
            <span />
          </button>
          <div className="mobile-head">
            <button
              type="button"
              className="mobile-origin"
              onClick={() => setMobileFilters(true)}
            >
              <span className="eyebrow">Starting from</span>
              <strong>{origin.name}</strong>
            </button>
            <div className="mobile-head-actions">
              <button
                type="button"
                className="icon-button"
                onClick={handleSurprise}
                aria-label="Surprise me"
              >
                <Shuffle size={16} />
              </button>
              <button
                type="button"
                className="mobile-filter-button"
                onClick={() => setMobileFilters(true)}
              >
                <SlidersHorizontal size={14} />
                Filters
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSheetExpanded((value) => !value)}
                aria-label={sheetExpanded ? 'Collapse the panel' : 'Expand the panel'}
              >
                {sheetExpanded ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
              </button>
            </div>
          </div>
          <p className="mobile-summary">
            {formatCount(totalWithin)} places · {minutes} min by {MODE_BY_ID[mode].label}
          </p>
          {tabBar}
          <div className="mobile-content">
            {tab === 'places' && placesPanel}
            {tab === 'trails' && trailPanel}
            {tab === 'saved' && savedPanel}
          </div>
        </section>
      )}

      {mobileFilters && (
        <Modal
          eyebrow="Refine the atlas"
          title="Shape the city to your mood."
          onClose={() => setMobileFilters(false)}
          className="filter-modal"
          footer={
            <button
              type="button"
              className="button button-primary is-wide"
              onClick={() => setMobileFilters(false)}
            >
              Show {formatCount(rows.length)} places
            </button>
          }
        >
          <FilterPanel {...filterProps} />
        </Modal>
      )}

      {aboutOpen && <About atlas={atlas} onClose={() => setAboutOpen(false)} />}

      {toast && (
        <div className="toast" role="status">
          <span className="toast-dot" />
          {toast}
        </div>
      )}

      {!isMobile && selected && (
        <div className="sr-only" aria-live="polite">
          {selected.name} details opened.
        </div>
      )}
    </div>
  );
}
