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
  /** True when the leg is older than the fresh TTL but still worth using. */
  stale?: boolean;
}

const cache = new Map<string, RouteLeg>();
const inFlight = new Set<string>();
const TTL = 20 * 60 * 1000;
const STALE_TTL = 24 * 60 * 60 * 1000;
const STORE_KEY = 'bengaluru-atlas:routes:v1';
const COOLDOWN_KEY = 'bengaluru-atlas:routing-cooldown:v1';
const RATE_LIMIT_MS = 12 * 60 * 1000;
const SERVER_ERROR_MS = 90 * 1000;
const NETWORK_ERROR_MS = 45 * 1000;
const MAX_STORED = 800;

let hydrated = false;
let persistTimer: number | null = null;
let blockedUntil = 0;
let blockedReason = '';

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        legs?: Record<string, RouteLeg>;
      } | null;
      if (parsed?.legs) {
        const now = Date.now();
        for (const [key, leg] of Object.entries(parsed.legs)) {
          if (!leg || typeof leg.at !== 'number') continue;
          if (now - leg.at > STALE_TTL) continue;
          if (typeof leg.km !== 'number' || typeof leg.minutes !== 'number') continue;
          if (!cache.has(key)) cache.set(key, leg);
        }
      }
    }
  } catch {
    try {
      window.localStorage.removeItem(STORE_KEY);
    } catch {
      /* storage can be disabled; the in-memory cache still works */
    }
  }

  try {
    const raw = window.localStorage.getItem(COOLDOWN_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { until?: number; reason?: string } | null;
    if (parsed?.until && parsed.until > Date.now()) {
      blockedUntil = parsed.until;
      blockedReason = parsed.reason || 'cooldown';
    } else {
      window.localStorage.removeItem(COOLDOWN_KEY);
    }
  } catch {
    /* a malformed cooldown is the same as no cooldown */
  }
}

function coolingDown(): boolean {
  hydrate();
  return blockedUntil > Date.now();
}

function setCooldown(ms: number, reason: string): void {
  blockedUntil = Date.now() + ms;
  blockedReason = reason;
  try {
    window.localStorage.setItem(
      COOLDOWN_KEY,
      JSON.stringify({ until: blockedUntil, reason }),
    );
  } catch {
    /* storage can be disabled; the in-memory cooldown still works */
  }
}

export function routingBackoff(): { until: number; reason: string } | null {
  hydrate();
  if (blockedUntil <= Date.now()) return null;
  return { until: blockedUntil, reason: blockedReason };
}

/**
 * Decide how long to leave the public endpoint alone. A rate limit is the
 * expensive one: the whole atlas shares the same few IP addresses, so a burst
 * of 429s should buy everyone a quiet twelve minutes.
 */
function noteFailure(response: Response): void {
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const wait =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(Math.max(retryAfter * 1000, 60 * 1000), 30 * 60 * 1000)
        : RATE_LIMIT_MS;
    setCooldown(wait, 'rate-limited');
    return;
  }
  if (response.status >= 500) setCooldown(SERVER_ERROR_MS, 'server');
}

function persist(): void {
  if (persistTimer != null) return;
  persistTimer = -1;
  const write = () => {
    persistTimer = null;
    try {
      const now = Date.now();
      const entries = [...cache.entries()]
        // Keep day-old legs: they are the fallback when OSRM is resting.
        .filter(([, leg]) => now - leg.at <= STALE_TTL)
        .sort((a, b) => b[1].at - a[1].at)
        .slice(0, MAX_STORED);
      const legs: Record<string, RouteLeg> = {};
      for (const [key, leg] of entries) legs[key] = leg;
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ at: now, legs }));
    } catch {
      /* a full or disabled store should never break routing */
    }
  };

  const idle = (
    window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (idle) idle(write, { timeout: 1400 });
  else persistTimer = window.setTimeout(write, 350);
}

function keyOf(origin: LatLon, placeId: string, mode: TravelMode): string {
  return `${mode}|${origin.lat.toFixed(4)}|${origin.lon.toFixed(4)}|${placeId}`;
}

/**
 * Any stored leg, fresh or stale. A stale leg is still a real road time, so it
 * is better than a modelled guess while OSRM is unavailable.
 */
export function cachedRoute(
  origin: LatLon,
  placeId: string,
  mode: TravelMode,
): RouteLeg | null {
  hydrate();
  const key = keyOf(origin, placeId, mode);
  const leg = cache.get(key);
  if (!leg) return null;
  const age = Date.now() - leg.at;
  if (age > STALE_TTL) {
    cache.delete(key);
    return null;
  }
  return age > TTL ? { ...leg, stale: true } : leg;
}

/** A leg fresh enough that asking OSRM again would be wasteful. */
function freshRoute(
  origin: LatLon,
  placeId: string,
  mode: TravelMode,
): RouteLeg | null {
  const leg = cachedRoute(origin, placeId, mode);
  return leg && !leg.stale ? leg : null;
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
  hydrate();
  // After a 429 or a run of server errors, stay quiet for a while. The list
  // keeps using whatever real legs the cache already holds.
  if (coolingDown()) return 0;
  const missing = places
    .filter(
      (place) =>
        !freshRoute(origin, place.id, mode) &&
        !inFlight.has(keyOf(origin, place.id, mode)),
    )
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
    if (!response.ok) {
      noteFailure(response);
      return 0;
    }
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
    persist();
    return added;
  } catch {
    if (!signal?.aborted) setCooldown(NETWORK_ERROR_MS, 'network');
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
  hydrate();
  const existing = cachedRoute(origin, place.id, mode);
  if (existing && !existing.stale) return existing;
  // A stale leg is still a usable answer while the endpoint is resting.
  if (coolingDown()) return existing;

  const url =
    `${HOST}/${PROFILES[mode].service}/route/v1/${PROFILES[mode].profile}/` +
    `${origin.lon.toFixed(5)},${origin.lat.toFixed(5)};${place.lon.toFixed(5)},${place.lat.toFixed(5)}` +
    '?overview=false&alternatives=false';
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      noteFailure(response);
      return null;
    }
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
    persist();
    return leg;
  } catch {
    if (!signal?.aborted) setCooldown(NETWORK_ERROR_MS, 'network');
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
