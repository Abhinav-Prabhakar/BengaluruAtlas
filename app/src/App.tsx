import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crosshair,
  RefreshCw,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  DEFAULT_MINUTES,
  MODE_BY_ID,
  TIME_STOPS,
} from './lib/catalog';
import {
  distanceKm,
  detourFrom,
  detourMinutes,
  estimateMinutes,
  formatCount,
  nearestArea,
  reachKm,
} from './lib/geo';
import { arrivalStatus, istClock } from './lib/hours';
import { MOODS, MOOD_BY_ID } from './lib/moods';
import {
  buildPlaceIndex,
  placeForTrailStop,
  placeHaystack,
  resolvePlaceId,
} from './lib/places';
import { sortRows } from './lib/rank';
import { cachedRoute, loadOneRoute, loadRouteTable } from './lib/routing';
import {
  congestionAt,
  loadTraffic,
  type TrafficState,
} from './lib/traffic';
import { formatClock, loadWeather, sunsetMinute } from './lib/weather';
import {
  readThemePref,
  readSaved,
  readVisited,
  writeSaved,
  writeVisited,
  writeThemePref,
} from './lib/storage';
import {
  applyPwaUpdate,
  onPwaUpdate,
  useInstallPrompt,
} from './lib/pwa';
import type {
  Atlas,
  Origin,
  Place,
  ResultRow,
  TabId,
  Theme,
  ThemePref,
  Trail,
  TravelMode,
  WeatherNow,
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
import SharedList from './components/SharedList';
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

function whenIdle(callback: () => void): void {
  const idle = (
    window as Window & {
      requestIdleCallback?: (run: () => void, options?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (idle) idle(callback, { timeout: 3500 });
  else window.setTimeout(callback, 2200);
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
  const isWide = useMediaQuery('(min-width: 1000px)');

  const [origin, setOrigin] = useState<Origin>(initial.origin);
  const [moods, setMoods] = useState<string[]>(initial.moods);
  const [mode, setMode] = useState<TravelMode>(initial.mode);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [query, setQuery] = useState(initial.query);
  const [traffic, setTraffic] = useState<TrafficState | null>(null);
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [tab, setTab] = useState<TabId>(initial.tab);
  const [selected, setSelected] = useState<Place | null>(initial.place);
  const [trailId, setTrailId] = useState<string | null>(initial.trail?.id ?? null);
  const [incoming, setIncoming] = useState<Place[] | null>(
    initial.sharedSaved.length ? initial.sharedSaved : null,
  );
  const [updateReady, setUpdateReady] = useState(false);
  const { canInstall, isStandalone, promptInstall } = useInstallPrompt();
  const [themePref, setThemePref] = useState<ThemePref>(
    () => readThemePref() ?? 'system',
  );
  const [systemTheme, setSystemTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const theme: Theme = themePref === 'system' ? systemTheme : themePref;
  const [saved, setSaved] = useState<Set<string>>(() => readSaved());
  const [visited, setVisited] = useState<Set<string>>(() => readVisited());
  const [pickMode, setPickMode] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(48);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [routeTick, setRouteTick] = useState(0);
  const [rankRevision, setRankRevision] = useState(0);
  const rankTimer = useRef<number | null>(null);

  const scheduleRank = useCallback(() => {
    if (rankTimer.current != null) window.clearTimeout(rankTimer.current);
    rankTimer.current = window.setTimeout(() => {
      rankTimer.current = null;
      setRankRevision((value) => value + 1);
    }, 520);
  }, []);

  useEffect(
    () => () => {
      if (rankTimer.current != null) window.clearTimeout(rankTimer.current);
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      loadTraffic().then((state) => {
        if (alive) setTraffic(state);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 10 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      loadWeather().then((value) => {
        if (alive) setWeather(value);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 11 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const raining = Boolean(
    weather && (weather.rainNow || weather.rainSoonChance >= 55),
  );
  const golden = Boolean(weather?.golden && !raining);
  const rainLater =
    !raining && weather?.rainLaterAt ? formatClock(weather.rainLaterAt) : null;
  const sunset = weather ? sunsetMinute(weather) : null;
  const nowMinutes = istClock().minutes;

  useEffect(() => onPwaUpdate(setUpdateReady), []);

  const baseRadiusKm = useMemo(() => reachKm(mode, minutes), [mode, minutes]);
  const originCongestion = useMemo(
    () => (traffic ? congestionAt(origin, traffic) : null),
    [traffic, origin],
  );
  const driveFactor =
    mode === 'auto' || mode === 'cab' ? originCongestion?.factor ?? 1 : 1;
  const radiusKm = baseRadiusKm / driveFactor;
  const trail = useMemo(
    () => atlas.trails.find((candidate) => candidate.id === trailId) || null,
    [atlas.trails, trailId],
  );

  const { haystacks, moodIndex } = useMemo(() => {
    const text = new Map<string, string>();
    const index = new Map<string, string[]>();
    for (const place of atlas.places) {
      const hay = placeHaystack(place);
      text.set(place.id, hay);
      index.set(
        place.id,
        MOODS.filter((mood) => mood.test(place, hay)).map((mood) => mood.id),
      );
    }
    return { haystacks: text, moodIndex: index };
  }, [atlas.places]);

  const { rows, moodCounts, totalWithin } = useMemo(() => {
    const nextMoods = Object.fromEntries(MOODS.map((mood) => [mood.id, 0])) as Record<
      string,
      number
    >;
    const needle = query.trim().toLowerCase();
    const inRange: ResultRow[] = [];
    const now = new Date();
    const clock = istClock(now);

    for (const place of atlas.places) {
      const km = distanceKm(origin, place);
      if (km > radiusKm) continue;
      if (needle && !(haystacks.get(place.id) || '').includes(needle)) continue;
      for (const id of moodIndex.get(place.id) || []) nextMoods[id] += 1;
      const factor =
        (mode === 'auto' || mode === 'cab') && traffic
          ? congestionAt(place, traffic).factor
          : 1;
      const minutes = Math.max(1, Math.round(estimateMinutes(km, mode) * factor));
      inRange.push({
        place,
        distanceKm: km,
        minutes,
        arrival: arrivalStatus(place.hours, minutes, now),
      });
    }

    const filtered =
      moods.length > 0
        ? inRange.filter((row) => {
            const ids = moodIndex.get(row.place.id) || [];
            return moods.some((mood) => ids.includes(mood));
          })
        : inRange;

    return {
      rows: sortRows(filtered, { raining, golden, clock, sunsetMinute: sunset }),
      moodCounts: nextMoods,
      totalWithin: inRange.length,
    };
  }, [atlas.places, origin, radiusKm, mode, query, moods, haystacks, moodIndex, traffic, raining, golden, sunset]);

  // Ask OSRM for real road times on the first screenful, then again whenever
  // the origin or travel mode changes. The table call costs one request.
  const candidateKey = useMemo(
    () => rows.slice(0, 90).map((row) => row.place.id).join('|'),
    [rows],
  );

  useEffect(() => {
    if (!rows.length) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      loadRouteTable(
        origin,
        rows.slice(0, 90).map((row) => row.place),
        mode,
        controller.signal,
      ).then((added) => {
        if (controller.signal.aborted) return;
        if (added > 0) {
          setRouteTick((value) => value + 1);
          scheduleRank();
        }
        if (added <= 0) return;

        // Warm the next screenful and the other common mode while the browser
        // is quiet. These never reorder the list; they only make the next
        // click instant.
        whenIdle(() => {
          if (controller.signal.aborted) return;
          const nextMode: TravelMode =
            mode === 'walk' || mode === 'bike' ? 'auto' : 'walk';
          const nextScreen = rows.slice(90, 138).map((row) => row.place);
          const alternate = rows.slice(0, 30).map((row) => row.place);
          void (async () => {
            let changed = 0;
            if (nextScreen.length) {
              changed += await loadRouteTable(origin, nextScreen, mode, controller.signal);
            }
            if (!controller.signal.aborted && alternate.length) {
              changed += await loadRouteTable(origin, alternate, nextMode, controller.signal);
            }
            if (changed > 0 && !controller.signal.aborted) {
              setRouteTick((value) => value + 1);
            }
          })();
        });
      });
    }, 650);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // rows is stable between filter changes; candidateKey captures its head.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lon, mode, candidateKey, scheduleRank]);

  // Deep links and map picks may not be in the first table; route them alone.
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    loadOneRoute(origin, selected, mode, controller.signal).then((leg) => {
      if (leg) setRouteTick((value) => value + 1);
    });
    return () => controller.abort();
  }, [selected, origin, mode]);

  const travelAdjusted = useMemo(
    () =>
      rows.map((row) => {
        const leg = cachedRoute(origin, row.place.id, mode);
        const congestion = traffic ? congestionAt(row.place, traffic) : null;
        const factor =
          mode === 'auto' || mode === 'cab' ? congestion?.factor ?? 1 : 1;
        const minutes = leg
          ? Math.max(1, Math.round(leg.minutes * factor))
          : row.minutes;
        return {
          ...row,
          distanceKm: leg?.km || row.distanceKm,
          minutes,
          live: Boolean(leg),
          traffic: congestion?.label,
          kmph: congestion?.kmph,
          freeKmph: congestion?.corridor?.freeKmph,
          arrival: arrivalStatus(row.place.hours, minutes),
        };
      }),
    [rows, origin, mode, traffic, routeTick],
  );

  const scopeKey = `${origin.lat.toFixed(4)},${origin.lon.toFixed(4)}|${mode}|${minutes}|${moods.join(',')}|${query.trim().toLowerCase()}|${raining}|${golden}|${sunset ?? ''}`;
  const orderRef = useRef<string[]>([]);
  const orderScope = useRef('');
  const orderRevision = useRef(-1);

  const rankedRows = useMemo(() => {
    const order = orderRef.current;
    const orderSet = new Set(order);
    const setChanged =
      order.length !== travelAdjusted.length ||
      travelAdjusted.some((row) => !orderSet.has(row.place.id));
    const shouldSort =
      setChanged || orderScope.current !== scopeKey || orderRevision.current !== rankRevision;

    if (shouldSort) {
      const sorted = sortRows(travelAdjusted, {
        raining,
        golden,
        clock: istClock(),
        sunsetMinute: sunset,
      });
      orderRef.current = sorted.map((row) => row.place.id);
      orderScope.current = scopeKey;
      orderRevision.current = rankRevision;
    }

    const byId = new Map(travelAdjusted.map((row) => [row.place.id, row]));
    return orderRef.current.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  }, [travelAdjusted, scopeKey, rankRevision, raining, golden, sunset]);

  const visibleRows = useMemo(
    () => rankedRows.slice(0, visibleCount),
    [rankedRows, visibleCount],
  );

  const rowForPlace = useCallback(
    (place: Place): ResultRow => {
      const leg = cachedRoute(origin, place.id, mode);
      const congestion = traffic ? congestionAt(place, traffic) : null;
      const factor =
        mode === 'auto' || mode === 'cab' ? congestion?.factor ?? 1 : 1;
      const plainKm = distanceKm(origin, place);
      const km = leg?.km || plainKm;
      const minutes = leg
        ? Math.max(1, Math.round(leg.minutes * factor))
        : Math.max(1, Math.round(estimateMinutes(km, mode) * factor));
      return {
        place,
        distanceKm: km,
        minutes,
        live: Boolean(leg),
        traffic: congestion?.label,
        kmph: congestion?.kmph,
        freeKmph: congestion?.corridor?.freeKmph,
        arrival: arrivalStatus(place.hours, minutes),
      };
    },
    [origin, mode, traffic],
  );

  const selectedRow = useMemo<ResultRow | null>(
    () => (selected ? rowForPlace(selected) : null),
    [selected, rowForPlace, routeTick],
  );

  const savedRows = useMemo(
    () =>
      [...saved].flatMap((id) => {
        const place = resolvePlaceId(atlas, places, id);
        return place ? [rowForPlace(place)] : [];
      }),
    [saved, atlas, places, rowForPlace, routeTick],
  );

  const visitedRows = useMemo(
    () =>
      [...visited].flatMap((id) => {
        const place = resolvePlaceId(atlas, places, id);
        return place ? [rowForPlace(place)] : [];
      }),
    [visited, atlas, places, rowForPlace, routeTick],
  );

  // Fetch road times for saved places when that tab is opened, so the list
  // uses the same honest times as the main results instead of a guess.
  useEffect(() => {
    if (tab !== 'saved') return;
    const placesToRoute = [...savedRows, ...visitedRows].map((row) => row.place);
    if (!placesToRoute.length) return;
    const controller = new AbortController();
    loadRouteTable(origin, placesToRoute, mode, controller.signal).then((added) => {
      if (added > 0 && !controller.signal.aborted) {
        setRouteTick((value) => value + 1);
      }
    });
    return () => controller.abort();
  }, [tab, origin, mode, savedRows, visitedRows]);

  // A quiet detour line in the place panel. This deliberately never touches
  // the order of any list; it only points out saved places that cost little.
  const onTheWay = useMemo(() => {
    if (!selected || savedRows.length === 0) return [];
    return savedRows
      .filter((row) => row.place.id !== selected.id)
      .flatMap((row) => {
        const detour = detourFrom(origin, selected, row.place);
        if (detour.fraction < 0.08 || detour.fraction > 0.92) return [];
        if (detour.offKm > 1.6) return [];
        const extraMinutes = detourMinutes(detour.extraKm, mode);
        if (extraMinutes > 9) return [];
        return [{ place: row.place, extraMinutes: Math.max(1, extraMinutes) }];
      })
      .sort((a, b) => a.extraMinutes - b.extraMinutes)
      .slice(0, 2);
  }, [selected, savedRows, origin, mode]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemTheme(media.matches ? 'dark' : 'light');
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) =>
        meta.setAttribute('content', theme === 'dark' ? '#0E100C' : '#F3EDE2'),
      );
  }, [theme]);

  useEffect(() => {
    writeThemePref(themePref);
  }, [themePref]);

  useEffect(() => {
    writeSaved(saved);
  }, [saved]);

  useEffect(() => {
    writeVisited(visited);
  }, [visited]);

  useEffect(() => {
    setVisibleCount(48);
  }, [origin, moods, mode, minutes, query]);

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
      moods,
      mode,
      minutes,
      query,
      tab,
      placeId: selected?.id ?? null,
      trailId,
      sharedIds: incoming?.map((place) => place.id) ?? null,
    });
    const next = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
    window.history.replaceState(null, '', next);
  }, [origin, moods, mode, minutes, query, tab, selected, trailId, incoming]);

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
      moods,
      mode,
      minutes,
      query,
      tab,
      placeId: selected?.id ?? null,
      trailId,
      sharedIds: incoming?.map((place) => place.id) ?? null,
    });

  const handleShare = async () => {
    const copied = await copyText(currentQuery());
    setToast(
      copied
        ? 'Link copied — filters, place and all.'
        : 'Could not copy the link. Try the address bar.',
    );
  };

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) setToast('Bengaluru Atlas is installing.');
  };

  const handleShareList = async () => {
    const ids = savedRows.map((row) => row.place.id);
    if (!ids.length) {
      setToast('Save a place first — then share the list.');
      return;
    }
    const url = buildShareUrl({
      origin,
      moods,
      mode,
      minutes,
      query,
      tab: 'saved',
      placeId: null,
      trailId: null,
      sharedIds: ids,
    });
    const title = 'Bengaluru Atlas — a list for you';
    const text = `${ids.length} ${ids.length === 1 ? 'place' : 'places'} from my Bengaluru Atlas field notes.`;

    if (isMobile && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        setToast('List shared.');
        return;
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        /* Fall through to copying when the share sheet is unavailable. */
      }
    }

    const copied = await copyText(url);
    setToast(
      copied
        ? `List link copied — ${ids.length} ${ids.length === 1 ? 'place' : 'places'} travel inside it.`
        : 'Could not copy the list link. Try the address bar.',
    );
  };

  const handleToggleTheme = () => {
    setThemePref(theme === 'dark' ? 'light' : 'dark');
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

  const handleToggleMood = (mood: string) => {
    setMoods((current) =>
      current.includes(mood)
        ? current.filter((value) => value !== mood)
        : [...current, mood],
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

  const handleSaveIncoming = () => {
    if (!incoming) return;
    const ids = incoming.map((place) => place.id);
    const fresh = ids.filter((id) => !saved.has(id)).length;
    setSaved((current) => {
      const next = new Set(current);
      for (const id of ids) next.add(id);
      return next;
    });
    setIncoming(null);
    setTab('saved');
    setSheetExpanded(true);
    setToast(
      fresh
        ? `Saved ${fresh} ${fresh === 1 ? 'place' : 'places'} from the shared list.`
        : 'Those places are already in your field notes.',
    );
  };

  const handleDismissIncoming = () => {
    setIncoming(null);
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
    setMoods([]);
    setMode('auto');
    setMinutes(DEFAULT_MINUTES);
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
    moods,
    mode,
    minutes,
    radiusKm,
    moodCounts,
    totalWithin,
    theme,
    traffic,
    onSelectArea: handleSelectArea,
    onNearMe: handleNearMe,
    onPickMap: handlePickMap,
    onToggleMood: handleToggleMood,
    onClearMoods: () => setMoods([]),
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
      moodsActive={moods.length > 0}
      canWiden={minutes < TIME_STOPS[TIME_STOPS.length - 1]}
      liveTimes={rankedRows.slice(0, visibleCount).some((row) => row.live)}
      rainy={raining}
      golden={golden}
      onQuery={setQuery}
      onSelect={(row) => setSelected(row.place)}
      onToggleSave={handleToggleSave}
      onShowMore={() => setVisibleCount((value) => value + 48)}
      onClearMoods={() => setMoods([])}
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
      origin={origin}
      theme={theme}
      visited={visited}
      sunsetMinute={sunset}
      nowMinute={nowMinutes}
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
      onShareList={handleShareList}
    />
  );

  const panelContent = (
    <>
      {tab === 'places' && placesPanel}
      {tab === 'trails' && trailPanel}
      {tab === 'saved' && savedPanel}
    </>
  );

  const railFooter = (
    <footer className="rail-footer">
      <span>
        © OpenStreetMap · OpenFreeMap · {formatCount(atlas.meta.total)} places
      </span>
      <button type="button" className="text-button" onClick={() => setAboutOpen(true)}>
        Data & credits
      </button>
    </footer>
  );

  return (
    <div className="app">
      <Topbar
        theme={theme}
        themePref={themePref}
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
              {!isWide && tabBar}
              {!isWide && <div className="rail-content">{panelContent}</div>}
              {railFooter}
            </div>
          </aside>
        )}

        {!isMobile && isWide && (
          <aside className="results-rail" aria-label="Places, trails and saved">
            {tabBar}
            <div className="results-scroll">{panelContent}</div>
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
            traffic={traffic}
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
              live={selectedRow.live}
              traffic={selectedRow.traffic}
              kmph={selectedRow.kmph}
              freeKmph={selectedRow.freeKmph}
              arrival={selectedRow.arrival}
              sunsetMinute={raining ? null : sunset}
              rainLaterLabel={rainLater}
              rainLaterMinute={raining ? null : weather?.rainLaterMinute ?? null}
              nowMinute={nowMinutes}
              onTheWay={onTheWay}
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

      {aboutOpen && (
        <About
          atlas={atlas}
          themePref={themePref}
          canInstall={canInstall && !isStandalone}
          isStandalone={isStandalone}
          onThemePref={setThemePref}
          onInstall={handleInstall}
          onClose={() => setAboutOpen(false)}
        />
      )}

      {incoming && (
        <SharedList
          places={incoming}
          saved={saved}
          theme={theme}
          onSaveAll={handleSaveIncoming}
          onClose={handleDismissIncoming}
        />
      )}

      {updateReady && (
        <div className="pwa-banner" role="status">
          <span className="pwa-banner-dot" aria-hidden="true" />
          <span>A newer atlas is ready.</span>
          <button type="button" onClick={applyPwaUpdate}>
            <RefreshCw size={12} />
            Update
          </button>
          <button
            type="button"
            className="pwa-banner-close"
            onClick={() => setUpdateReady(false)}
            aria-label="Dismiss the update notice"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
