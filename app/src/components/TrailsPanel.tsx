import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownUp,
  Check,
  Clock3,
  Compass,
  Footprints,
  Landmark,
  MapPin,
  Moon,
  Mountain,
  Route,
  Search,
  ShoppingBag,
  Sunset,
  Utensils,
  X,
} from 'lucide-react';
import { CATEGORY_BY_ID, categoryColor } from '../lib/catalog';
import { distanceKm } from '../lib/geo';
import { formatClockMinutes } from '../lib/hours';
import { durationMinutes } from '../lib/time';
import type { Origin, Theme, Trail, TrailStop } from '../lib/types';

interface TrailsPanelProps {
  trails: Trail[];
  activeTrail: Trail | null;
  origin: Origin;
  theme: Theme;
  visited: Set<string>;
  sunsetMinute?: number | null;
  nowMinute?: number;
  onSelectTrail: (trail: Trail) => void;
  onClearTrail: () => void;
  onSelectStop: (trail: Trail, stop: TrailStop, index: number) => void;
}

type TrailSort = 'recommended' | 'shortest' | 'longest' | 'stops' | 'closest';

const KIND_META: Record<
  string,
  { label: string; icon: typeof Footprints }
> = {
  walk: { label: 'City walk', icon: Footprints },
  cab: { label: 'City drive', icon: Route },
  food: { label: 'Food crawl', icon: Utensils },
  culture: { label: 'Culture walk', icon: Landmark },
  outdoors: { label: 'Green loop', icon: Mountain },
  shop: { label: 'Shop crawl', icon: ShoppingBag },
  night: { label: 'After dark', icon: Moon },
  daytrip: { label: 'Day trip', icon: Compass },
};

const SORT_LABEL: Record<TrailSort, string> = {
  recommended: 'Recommended',
  shortest: 'Shortest first',
  longest: 'Longest first',
  stops: 'Most stops',
  closest: 'Closest to me',
};

const PAGE = 24;

function kindMeta(trail: Trail) {
  return KIND_META[trail.kind] || KIND_META.walk;
}

function kindLabel(trail: Trail): string {
  return kindMeta(trail).label;
}

function parseDistance(value: string): number {
  const match = /([\d.]+)/.exec(value);
  return match ? Number(match[1]) : 0;
}

/**
 * A one-line daylight budget for a trail. It only appears when the answer is
 * close enough to matter: either the start-by time is within four hours, or a
 * shorter trail has already passed its window.
 */
function daylightNote(
  trail: Trail,
  sunset: number | null | undefined,
  now: number | undefined,
): { text: string; late: boolean } | null {
  if (trail.kind === 'night' || sunset == null || now == null) return null;
  const duration = durationMinutes(trail.duration);
  if (!duration || now >= sunset) return null;

  const latestStart = sunset - duration - 20;
  if (now >= latestStart) {
    if (duration > 5 * 60) return null;
    return {
      text: `Too late to finish in daylight today — sunset is at ${formatClockMinutes(sunset)}.`,
      late: true,
    };
  }

  if (latestStart - now <= 4 * 60) {
    return {
      text: `Start by ${formatClockMinutes(latestStart)} to finish before sunset at ${formatClockMinutes(sunset)}.`,
      late: false,
    };
  }

  return null;
}

function TrailThumb({ trail }: { trail: Trail }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [trail.id]);
  const Icon = kindMeta(trail).icon;

  if (trail.img && !failed) {
    return (
      <span className="trail-thumb has-image">
        <img
          src={trail.img}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
        <span className="trail-thumb-icon">
          <Icon size={10} strokeWidth={2.2} />
        </span>
      </span>
    );
  }

  return (
    <span className="trail-thumb is-blank" aria-hidden="true">
      <Icon size={22} strokeWidth={1.25} />
    </span>
  );
}

function TrailSpark({ trail }: { trail: Trail }) {
  const points = useMemo(() => {
    if (trail.stops.length < 2) return [];
    const lats = trail.stops.map((stop) => stop.lat);
    const lons = trail.stops.map((stop) => stop.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const spanX = maxLon - minLon || 1;
    const spanY = maxLat - minLat || 1;
    return trail.stops.map((stop) => ({
      x: 5 + ((stop.lon - minLon) / spanX) * 54,
      y: 19 - ((stop.lat - minLat) / spanY) * 14,
      name: stop.name,
    }));
  }, [trail]);

  if (points.length < 2) return null;

  return (
    <svg
      className="trail-spark"
      viewBox="0 0 64 24"
      role="img"
      aria-label={`Sketch of ${trail.stops.length} stops`}
    >
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.55"
      />
      {points.map((point, index) => (
        <circle
          key={`${point.name}-${index}`}
          cx={point.x}
          cy={point.y}
          r={index === 0 || index === points.length - 1 ? 2.4 : 1.6}
          fill={index === 0 || index === points.length - 1 ? 'currentColor' : 'var(--paper)'}
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

export default function TrailsPanel({
  trails,
  activeTrail,
  origin,
  theme,
  visited,
  sunsetMinute,
  nowMinute,
  onSelectTrail,
  onClearTrail,
  onSelectStop,
}: TrailsPanelProps) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [sort, setSort] = useState<TrailSort>('recommended');
  const [limit, setLimit] = useState(PAGE);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLimit(PAGE);
  }, [query, kind, sort]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (event.key === '/' && !typing && !document.querySelector('[role="dialog"]')) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const trail of trails) {
      counts.set(trail.kind, (counts.get(trail.kind) || 0) + 1);
    }
    return counts;
  }, [trails]);

  const availableKinds = useMemo(
    () =>
      Object.keys(KIND_META).filter((key) => (kindCounts.get(key) || 0) > 0),
    [kindCounts],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = trails.filter((trail) => {
      if (kind !== 'all' && trail.kind !== kind) return false;
      if (!needle) return true;
      const haystack = [
        trail.title,
        trail.kicker,
        trail.note,
        trail.area || '',
        ...(trail.tags || []),
        ...trail.stops.map((stop) => stop.name),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });

    if (sort === 'recommended') return rows;
    const sorted = [...rows];
    if (sort === 'shortest') {
      sorted.sort((a, b) => parseDistance(a.distance) - parseDistance(b.distance));
    } else if (sort === 'longest') {
      sorted.sort((a, b) => parseDistance(b.distance) - parseDistance(a.distance));
    } else if (sort === 'stops') {
      sorted.sort((a, b) => b.stops.length - a.stops.length);
    } else if (sort === 'closest') {
      sorted.sort((a, b) => {
        const aStop = a.stops[0];
        const bStop = b.stops[0];
        if (!aStop || !bStop) return 0;
        return distanceKm(origin, aStop) - distanceKm(origin, bStop);
      });
    }
    return sorted;
  }, [trails, query, kind, sort, origin]);

  const shown = filtered.slice(0, limit);

  if (activeTrail) {
    const trail = activeTrail;
    const Icon = kindMeta(trail).icon;
    const done = trail.stops.filter((stop) => stop.id && visited.has(stop.id)).length;
    const daylight = daylightNote(trail, sunsetMinute, nowMinute);
    return (
      <div className="trails-panel is-detail" style={{ '--trail': trail.color } as CSSProperties}>
        <button type="button" className="back-button" onClick={onClearTrail}>
          <ArrowLeft size={14} />
          All {trails.length} trails
        </button>

        {trail.img && (
          <div className="trail-detail-hero">
            <img src={trail.img} alt="" loading="lazy" decoding="async" />
            <span className="trail-detail-veil" />
            <span className="trail-detail-kind">
              <Icon size={11} />
              {kindLabel(trail)}
            </span>
            {trail.imgPage && (
              <a
                className="trail-detail-scope"
                href={trail.imgPage}
                target="_blank"
                rel="noreferrer"
              >
                {trail.imgScope === 'area' ? 'Neighbourhood photo' : 'Photo'}
                {trail.imgCredit ? ` · ${trail.imgCredit}` : ''}
              </a>
            )}
          </div>
        )}

        <header className="trail-detail-head">
          <p className="eyebrow">
            <span className="trail-swatch is-inline" />
            {kindLabel(trail)} · {trail.area || 'Bengaluru'}
          </p>
          <h3>{trail.title}</h3>
          <p className="trail-kicker is-lead">{trail.kicker}</p>
          <p className="trail-note">{trail.note}</p>
        </header>

        <dl className="trail-facts">
          <div>
            <dt>
              <Clock3 size={12} /> Time
            </dt>
            <dd>{trail.duration}</dd>
          </div>
          <div>
            <dt>
              <Route size={12} /> Distance
            </dt>
            <dd>{trail.distance}</dd>
          </div>
          <div>
            <dt>
              <Footprints size={12} /> Best
            </dt>
            <dd>{trail.bestTime}</dd>
          </div>
          <div>
            <dt>
              <MapPin size={12} /> Stops
            </dt>
            <dd>{trail.stops.length}</dd>
          </div>
        </dl>

        {daylight && (
          <p className={`trail-daylight ${daylight.late ? 'is-late' : ''}`}>
            <Sunset size={12} />
            {daylight.text}
          </p>
        )}

        {done > 0 && (
          <p className="trail-progress">
            <Check size={12} />
            {done} of {trail.stops.length} stops visited
          </p>
        )}

        <ol className="trail-stop-list">
          {trail.stops.map((stop, index) => {
            const category = CATEGORY_BY_ID[stop.cat];
            const StopIcon = category.icon;
            const color = categoryColor(stop.cat, theme);
            return (
              <li key={stop.id || `${trail.id}-${index}`}>
                <button
                  type="button"
                  className={`trail-stop ${
                    stop.id && visited.has(stop.id) ? 'is-visited' : ''
                  }`}
                  onClick={() => onSelectStop(trail, stop, index)}
                >
                  <span className="stop-number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="stop-body">
                    <span className="stop-top">
                      <strong>{stop.name}</strong>
                      <span className="stop-cat" style={{ color }}>
                        {stop.id && visited.has(stop.id) ? (
                          <Check size={11} />
                        ) : (
                          <StopIcon size={11} />
                        )}
                        {category.label}
                      </span>
                    </span>
                    <span className="stop-note">{stop.note}</span>
                  </span>
                  <ArrowUpRight size={14} className="stop-arrow" />
                </button>
              </li>
            );
          })}
        </ol>

        <p className="trail-fineprint">
          Stops are in suggested order. The line on the map is a sketch between
          them, not a turn-by-turn route.
        </p>
        <button type="button" className="button button-secondary is-wide" onClick={onClearTrail}>
          Show places instead
        </button>
      </div>
    );
  }

  const walks = trails.filter((trail) => trail.kind !== 'daytrip').length;
  const trips = trails.length - walks;
  const activeKind = kind === 'all' ? null : KIND_META[kind];

  return (
    <div className="trails-panel">
      <div className="panel-intro">
        <p className="eyebrow">Routes we like</p>
        <h3>{trails.length} ways into the city.</h3>
        <p>
          {walks} walks, crawls and loops, plus {trips} day trips, stitched from
          the atlas. They ignore the travel window — pick one when you have an
          afternoon.
        </p>
      </div>

      <div className="trail-browser">
        <div className="trail-search">
          <Search size={14} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('');
            }}
            placeholder="Search trails, areas or stops"
            aria-label="Search trails"
          />
          {query ? (
            <button
              type="button"
              className="trail-search-clear"
              onClick={() => setQuery('')}
              aria-label="Clear trail search"
            >
              <X size={13} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </div>

        <div className="trail-chips" role="group" aria-label="Filter trails by kind">
          <button
            type="button"
            className={`trail-chip ${kind === 'all' ? 'is-on' : ''}`}
            onClick={() => setKind('all')}
            aria-pressed={kind === 'all'}
          >
            All <span>{trails.length}</span>
          </button>
          {availableKinds.map((key) => {
            const meta = KIND_META[key];
            const ChipIcon = meta.icon;
            return (
              <button
                type="button"
                key={key}
                className={`trail-chip ${kind === key ? 'is-on' : ''}`}
                onClick={() => setKind(key)}
                aria-pressed={kind === key}
              >
                <ChipIcon size={11} />
                {meta.label} <span>{kindCounts.get(key)}</span>
              </button>
            );
          })}
        </div>

        <div className="trail-listbar">
          <span>
            {filtered.length} trail{filtered.length === 1 ? '' : 's'}
            {query && ` for “${query}”`}
          </span>
          <label className="trail-sort">
            <ArrowDownUp size={11} />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as TrailSort)}
              aria-label="Sort trails"
            >
              {(Object.keys(SORT_LABEL) as TrailSort[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="trail-empty">
            <p>No trail matches that yet.</p>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setQuery('');
                setKind('all');
              }}
            >
              Clear search and filters
            </button>
          </div>
        ) : (
          <>
            <ul className="trail-list">
              {shown.map((trail) => {
                const Icon = kindMeta(trail).icon;
                const done = trail.stops.filter(
                  (stop) => stop.id && visited.has(stop.id),
                ).length;
                return (
                  <li key={trail.id}>
                    <button
                      type="button"
                      className="trail-card"
                      onClick={() => onSelectTrail(trail)}
                      style={{ '--trail': trail.color } as CSSProperties}
                    >
                      <TrailThumb trail={trail} />
                      <span className="trail-card-body">
                        <span className="trail-card-top">
                          <span className="trail-kind">
                            <Icon size={9} />
                            {kindLabel(trail)}
                          </span>
                          <span className="trail-meta">
                            {trail.duration} · {trail.distance}
                          </span>
                        </span>
                        <strong>{trail.title}</strong>
                        <span className="trail-kicker">{trail.kicker}</span>
                        <span className="trail-stops-line">
                          {trail.area || 'Bengaluru'} · {trail.stops.length} stops
                          {done > 0 ? ` · ${done} visited` : ''} · best{' '}
                          {trail.bestTime}
                        </span>
                      </span>
                      <span className="trail-spark-wrap" aria-hidden="true">
                        <TrailSpark trail={trail} />
                        <ArrowUpRight size={14} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {limit < filtered.length && (
              <button
                type="button"
                className="button button-secondary is-wide trail-more"
                onClick={() => setLimit((value) => value + PAGE)}
              >
                Show {Math.min(PAGE, filtered.length - limit)} more
              </button>
            )}
            <p className="trail-fineprint">
              {activeKind ? `${activeKind.label}s` : 'Every trail'} · {trails.length} in
              all · stops open as places on the map.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
