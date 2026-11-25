/**
 * Road routing through the public OSRM instances hosted by OpenStreetMap.de.
 *
 * The atlas is a static site, so every route is fetched in the browser and
 * cached in memory. One table request costs the same as one route and returns
 * up to 99 destinations, which is why the list routes the first screenful of
 * results at once instead of one card at a time.
 */

import type { Place, TravelMode } from './types';
import type { LatLon } from './geo';

const HOST = 'https://routing.openstreetmap.de';

const PROFILES: Record<TravelMode, { service: string; profile: string }> = {
  walk: { service: 'routed-foot', profile: 'walking' },
  bike: { service: 'routed-bike', profile: 'cycling' },
  auto: { service: 'routed-car', profile: 'driving' },
  cab: { service: 'routed-car', profile: 'driving' },
};

export interface RouteLeg {
  km: number;
  minutes: number;
  /** When the leg was fetched, for a subtle freshness cue. */
  at: number;
}

const cache = new Map<string, RouteLeg>();
const inFlight = new Set<string>();
const TTL = 20 * 60 * 1000;

function keyOf(origin: LatLon, placeId: string, mode: TravelMode): string {
  return `${mode}|${origin.lat.toFixed(4)}|${origin.lon.toFixed(4)}|${placeId}`;
}

export function cachedRoute(
  origin: LatLon,
  placeId: string,
  mode: TravelMode,
): RouteLeg | null {
  const leg = cache.get(keyOf(origin, placeId, mode));
  if (!leg) return null;
  if (Date.now() - leg.at > TTL) {
    cache.delete(keyOf(origin, placeId, mode));
    return null;
  }
  return leg;
}

export function routeCacheSize(): number {
  return cache.size;
}

/**
 * Fetch durations for up to 99 places in one request. Returns the number of
 * new legs that arrived.
 */
export async function loadRouteTable(
  origin: LatLon,
  places: Place[],
  mode: TravelMode,
  signal?: AbortSignal,
): Promise<number> {
  const missing = places
    .filter((place) => !cachedRoute(origin, place.id, mode) && !inFlight.has(keyOf(origin, place.id, mode)))
    .slice(0, 99);
  if (!missing.length) return 0;

  const coords = [
    `${origin.lon.toFixed(5)},${origin.lat.toFixed(5)}`,
    ...missing.map((place) => `${place.lon.toFixed(5)},${place.lat.toFixed(5)}`),
  ].join(';');

  const url =
    `${HOST}/${PROFILES[mode].service}/table/v1/${PROFILES[mode].profile}/${coords}` +
    '?sources=0&annotations=duration,distance';

  missing.forEach((place) => inFlight.add(keyOf(origin, place.id, mode)));
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return 0;
    const data = (await response.json()) as {
      code: string;
      durations?: (number | null)[][];
      distances?: (number | null)[][];
    };
    if (data.code !== 'Ok' || !data.durations?.length) return 0;

    const durations = data.durations[0] ?? [];
    const distances = data.distances?.[0] ?? [];
    let added = 0;
    missing.forEach((place, index) => {
      const seconds = durations[index + 1];
      const metres = distances[index + 1];
      if (seconds == null || seconds <= 0) return;
      cache.set(keyOf(origin, place.id, mode), {
        km: metres ? metres / 1000 : 0,
        minutes: Math.max(1, Math.round(seconds / 60)),
        at: Date.now(),
      });
      added += 1;
    });
    return added;
  } catch {
    return 0;
  } finally {
    missing.forEach((place) => inFlight.delete(keyOf(origin, place.id, mode)));
  }
}

/** A single route, used for a place selected from the map or a deep link. */
export async function loadOneRoute(
  origin: LatLon,
  place: Place,
  mode: TravelMode,
  signal?: AbortSignal,
): Promise<RouteLeg | null> {
  const existing = cachedRoute(origin, place.id, mode);
  if (existing) return existing;

  const url =
    `${HOST}/${PROFILES[mode].service}/route/v1/${PROFILES[mode].profile}/` +
    `${origin.lon.toFixed(5)},${origin.lat.toFixed(5)};${place.lon.toFixed(5)},${place.lat.toFixed(5)}` +
    '?overview=false&alternatives=false';
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      code: string;
      routes?: Array<{ duration: number; distance: number }>;
    };
    const route = data.routes?.[0];
    if (!route) return null;
    const leg = {
      km: route.distance / 1000,
      minutes: Math.max(1, Math.round(route.duration / 60)),
      at: Date.now(),
    };
    cache.set(keyOf(origin, place.id, mode), leg);
    return leg;
  } catch {
    return null;
  }
}

export function googleMapsUrl(place: Place, mode: TravelMode): string {
  const travel = mode === 'walk' ? 'walking' : mode === 'bike' ? 'bicycling' : 'driving';
  return (
    `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}` +
    `&destination_place_id=${encodeURIComponent(place.name)}&travelmode=${travel}`
  );
}
