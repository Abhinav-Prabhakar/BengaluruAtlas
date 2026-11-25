import { DEFAULT_MINUTES, DEFAULT_MODE, MODE_BY_ID, TIME_STOPS } from './catalog';
import { nearestArea } from './geo';
import { MOOD_BY_ID } from './moods';
import { resolvePlaceId } from './places';
import type { Atlas, Origin, Place, TabId, Trail, TravelMode } from './types';

export interface InitialState {
  origin: Origin;
  moods: string[];
  mode: TravelMode;
  minutes: number;
  query: string;
  place: Place | null;
  trail: Trail | null;
  tab: TabId;
  /** A saved list that arrived in the URL, ready to be imported. */
  sharedSaved: Place[];
}

function areaOrigin(atlas: Atlas, areaId: string | null): Origin {
  const fallback = atlas.areas.find((area) => area.id === 'mg-road') || atlas.areas[0];
  const area = atlas.areas.find((candidate) => candidate.id === areaId) || fallback;
  return {
    id: area.id,
    name: area.name,
    lat: area.lat,
    lon: area.lon,
    kind: 'area',
    areaId: area.id,
  };
}

function nearestMinutes(value: number): number {
  let best: number = TIME_STOPS[0];
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const stop of TIME_STOPS) {
    const delta = Math.abs(stop - value);
    if (delta < bestDelta) {
      best = stop;
      bestDelta = delta;
    }
  }
  return best;
}

function parseTab(value: string | null): TabId | null {
  return value === 'places' || value === 'trails' || value === 'saved' ? value : null;
}

/**
 * A shared saved list travels as comma-separated place ids in `?saved=`.
 * Unknown ids (from an older atlas build) are ignored, and duplicates keep
 * their first position.
 */
function parseSharedSaved(
  value: string | null,
  atlas: Atlas,
  places: Map<string, Place>,
): Place[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const raw of value.split(',')) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const place = resolvePlaceId(atlas, places, id);
    if (place) out.push(place);
  }
  return out;
}

export function readInitialState(atlas: Atlas, places: Map<string, Place>): InitialState {
  const params = new URLSearchParams(window.location.search);
  const areaParam = params.get('area');
  let origin = areaOrigin(atlas, areaParam);

  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (areaParam === 'pin' && Number.isFinite(lat) && Number.isFinite(lon)) {
    const near = nearestArea(atlas.areas, { lat, lon });
    origin = {
      id: 'pin',
      name: params.get('pin') || `Near ${near.name}`,
      lat,
      lon,
      kind: 'pin',
    };
  }

  const moodParam = params.get('mood');
  const moods = moodParam
    ? moodParam
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value in MOOD_BY_ID)
    : [];

  const modeParam = params.get('mode') as TravelMode | null;
  const mode =
    modeParam && modeParam in MODE_BY_ID ? modeParam : DEFAULT_MODE;

  const timeParam = Number(params.get('time'));
  const minutes = Number.isFinite(timeParam) && timeParam > 0
    ? nearestMinutes(timeParam)
    : DEFAULT_MINUTES;

  const query = params.get('q') || '';

  const placeParam = params.get('place');
  const place = placeParam ? resolvePlaceId(atlas, places, placeParam) : null;

  const trailParam = params.get('trail');
  const trail = trailParam
    ? atlas.trails.find((candidate) => candidate.id === trailParam) || null
    : null;

  const sharedSaved = parseSharedSaved(params.get('saved'), atlas, places);
  const tab: TabId = sharedSaved.length
    ? 'saved'
    : trail
      ? 'trails'
      : parseTab(params.get('tab')) || 'places';

  return { origin, moods, mode, minutes, query, place, trail, tab, sharedSaved };
}

interface UrlState {
  origin: Origin;
  moods: string[];
  mode: TravelMode;
  minutes: number;
  query: string;
  placeId: string | null;
  trailId: string | null;
  tab: TabId;
  /** When set, these ids ride along in `?saved=` as an importable list. */
  sharedIds?: string[] | null;
}

export function buildQueryString(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.origin.kind === 'area' && state.origin.areaId) {
    params.set('area', state.origin.areaId);
  } else {
    params.set('area', 'pin');
    params.set('lat', state.origin.lat.toFixed(5));
    params.set('lon', state.origin.lon.toFixed(5));
    if (state.origin.name && state.origin.kind === 'pin') {
      params.set('pin', state.origin.name);
    }
  }
  if (state.moods.length) params.set('mood', state.moods.join(','));
  if (state.mode !== DEFAULT_MODE) params.set('mode', state.mode);
  if (state.minutes !== DEFAULT_MINUTES) params.set('time', String(state.minutes));
  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.tab !== 'places') params.set('tab', state.tab);
  if (state.placeId) params.set('place', state.placeId);
  if (state.trailId) params.set('trail', state.trailId);
  if (state.sharedIds?.length) params.set('saved', state.sharedIds.join(','));
  return params.toString();
}

export function buildShareUrl(state: UrlState): string {
  const query = buildQueryString(state);
  const base = `${window.location.origin}${window.location.pathname}`;
  return query ? `${base}?${query}` : base;
}
