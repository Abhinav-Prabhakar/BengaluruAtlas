/**
 * Live traffic for Bengaluru.
 *
 * The atlas itself is a static file, so this module does two things at runtime:
 *
 *  1. It learns the current speed on 13 instrumented city corridors. Readings
 *     are published every ten minutes; we read the latest commit that touched
 *     the CSV and fall back to the baked 24-hour profile for each corridor when
 *     GitHub is unreachable or rate-limited.
 *  2. It turns those readings into a local slowdown factor for any point in the
 *     city, so a trip through the ORR at 6pm is costed differently from the same
 *     trip at 6am.
 *
 * The numbers are honest: they are modelled from real corridor speeds, not
 * invented. Where the atlas shows "live", a road route was actually fetched.
 */

export interface Corridor {
  id: string;
  name: string;
  from: string;
  to: string;
  start: [number, number];
  end: [number, number];
  /** [lon, lat] pairs following the real road. */
  path: [number, number][];
  /** Free-flow speed in km/h. */
  freeKmph: number;
  /** Median observed speed for each hour of the day, in km/h. */
  hourly: (number | null)[];
  liveKmph?: number | null;
}

export interface TrafficModel {
  generated: string;
  latestReading: string | null;
  source: string;
  corridors: Corridor[];
}

export interface TrafficState {
  model: TrafficModel | null;
  /** Live km/h keyed by corridor id. */
  live: Record<string, number>;
  measuredAt: string | null;
  /** True when the readings came from the network rather than the baked profile. */
  isLive: boolean;
  hour: number;
}

const GITHUB_API = 'https://api.github.com';
const TRAFFIC_PATH = 'data/csv-traffic-bangalore.csv';
const CACHE_KEY = 'atlas:traffic:v1';
const CACHE_TTL = 10 * 60 * 1000;

let modelPromise: Promise<TrafficModel | null> | null = null;

export function loadTrafficModel(): Promise<TrafficModel | null> {
  if (!modelPromise) {
    modelPromise = fetch(`${import.meta.env.BASE_URL}data/traffic.json`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return modelPromise;
}

export function istHour(date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  return Number.isFinite(hour) ? hour % 24 : 0;
}

function parseIso(ts: string | null | undefined): string {
  return ts ? ts.replace(' ', 'T') + '+05:30' : '';
}

interface Cached {
  at: number;
  readings: Record<string, number>;
  measuredAt: string;
}

function readCache(): Cached | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (Date.now() - parsed.at > CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(value: Cached) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    /* storage can be full or blocked; the profile still works */
  }
}

/** Read the newest CSV rows out of the commit that last touched the dataset. */
async function fetchLiveReadings(): Promise<Cached | null> {
  const cached = readCache();
  if (cached) return cached;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6500);
  try {
    const list = await fetch(
      `${GITHUB_API}/repos/thecont1/traffic-monitor-lizard/commits?path=${encodeURIComponent(TRAFFIC_PATH)}&per_page=1`,
      { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } },
    );
    if (!list.ok) return null;
    const commits = (await list.json()) as Array<{ sha: string }>;
    if (!commits.length) return null;

    const detail = await fetch(`${GITHUB_API}/repos/thecont1/traffic-monitor-lizard/commits/${commits[0].sha}`, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!detail.ok) return null;
    const payload = (await detail.json()) as {
      files?: Array<{ filename: string; patch?: string }>;
    };
    const patch = payload.files?.find((file) => file.filename === TRAFFIC_PATH)?.patch ?? '';

    // Added lines in the diff are the newest readings: date,time,route,...
    const rows = patch
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.slice(1).split(','))
      .filter((cols) => cols.length >= 5 && /^\d{4}-\d{2}-\d{2}$/.test(cols[0]));

    if (!rows.length) return null;

    const readings: Record<string, number> = {};
    let measuredAt = '';
    for (const cols of rows) {
      const [date, time, code, duration, distance] = cols;
      const minutes = Number(duration);
      const km = Number(distance);
      if (!minutes || !km) continue;
      readings[code] = Math.round((km / minutes) * 60 * 10) / 10;
      const stamp = `${date} ${time}`;
      if (stamp > measuredAt) measuredAt = stamp;
    }
    if (!Object.keys(readings).length) return null;

    const value = { at: Date.now(), readings, measuredAt };
    writeCache(value);
    return value;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function loadTraffic(): Promise<TrafficState> {
  const model = await loadTrafficModel();
  const hour = istHour();
  let live: Record<string, number> = {};
  let measuredAt: string | null = null;
  let isLive = false;

  if (model) {
    const fresh = await fetchLiveReadings();
    if (fresh) {
      live = fresh.readings;
      measuredAt = fresh.measuredAt;
      isLive = true;
    } else {
      for (const corridor of model.corridors) {
        if (corridor.liveKmph) live[corridor.id] = corridor.liveKmph;
      }
      measuredAt = model.latestReading;
    }
  }

  return { model, live, measuredAt, isLive, hour };
}

function speedNow(corridor: Corridor, state: TrafficState): number {
  const live = state.live[corridor.id];
  if (live && live > 0) return live;
  const typical = corridor.hourly[state.hour];
  if (typical && typical > 0) return typical;
  return corridor.freeKmph * 0.72;
}

/** km per degree of longitude at Bengaluru's latitude. */
const LON_KM = 111.32 * Math.cos((12.97 * Math.PI) / 180);
const LAT_KM = 110.57;

function segmentKm(
  point: { lat: number; lon: number },
  a: [number, number],
  b: [number, number],
): number {
  const px = (point.lon - a[0]) * LON_KM;
  const py = (point.lat - a[1]) * LAT_KM;
  const bx = (b[0] - a[0]) * LON_KM;
  const by = (b[1] - a[1]) * LAT_KM;
  const len = bx * bx + by * by;
  if (!len) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / len));
  return Math.hypot(px - t * bx, py - t * by);
}

/** Distance from a point to a corridor, in kilometres. */
export function distanceToCorridor(
  point: { lat: number; lon: number },
  corridor: Corridor,
): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < corridor.path.length; i += 1) {
    best = Math.min(best, segmentKm(point, corridor.path[i - 1], corridor.path[i]));
  }
  return best;
}

export interface Congestion {
  factor: number;
  kmph: number;
  corridor: Corridor | null;
  label: 'light' | 'moving' | 'heavy' | 'gridlock';
  /** True when a live reading, not the hourly profile, produced the factor. */
  measured: boolean;
}

function congestionLabel(factor: number): Congestion['label'] {
  if (factor < 1.12) return 'light';
  if (factor < 1.4) return 'moving';
  if (factor < 1.85) return 'heavy';
  return 'gridlock';
}

/**
 * A local slowdown factor for a trip. Each corridor contributes in inverse
 * proportion to its distance from the place, so the ORR affects Whitefield
 * more than Malleshwaram, and the airport road affects the north.
 */
export function congestionAt(
  point: { lat: number; lon: number },
  state: TrafficState,
): Congestion {
  const corridors = state.model?.corridors ?? [];
  let weighted = 0;
  let weight = 0;
  let best: { corridor: Corridor; km: number } | null = null;

  for (const corridor of corridors) {
    const km = distanceToCorridor(point, corridor);
    if (!best || km < best.km) best = { corridor, km };
    if (km > 7) continue;
    const w = 1 / Math.max(0.35, km) ** 2;
    const factor = Math.min(2.6, corridor.freeKmph / Math.max(4, speedNow(corridor, state)));
    weighted += factor * w;
    weight += w;
  }

  const fallback = state.model
    ? state.model.corridors.reduce((acc, corridor) => {
        return acc + corridor.freeKmph / Math.max(4, speedNow(corridor, state));
      }, 0) / Math.max(1, state.model.corridors.length)
    : 1.25;

  const factor = weight > 0 ? weighted / weight : fallback;
  const near = best && best.km < 9 ? best.corridor : null;
  const nearFreeKmph = best ? best.corridor.freeKmph : 30;
  const kmph = near ? speedNow(near, state) : Math.round(nearFreeKmph / factor);

  return {
    factor: Math.max(0.8, Math.min(2.4, factor)),
    kmph,
    corridor: near,
    label: congestionLabel(factor),
    measured: Boolean(near && state.live[near.id]),
  };
}

export function trafficHeadline(state: TrafficState | null): string {
  if (!state?.model) return 'Modelled travel times';
  const readings = state.model.corridors
    .map((corridor) => ({ corridor, kmph: speedNow(corridor, state) }))
    .filter((entry) => entry.kmph > 0);
  if (!readings.length) return 'Modelled travel times';
  const slowest = readings.reduce((a, b) => (b.kmph < a.kmph ? b : a));
  const average = Math.round(
    readings.reduce((sum, entry) => sum + entry.kmph, 0) / readings.length,
  );
  return `${average} km/h citywide · ${slowest.corridor.name} slowest at ${Math.round(slowest.kmph)}`;
}

export function trafficMoment(state: TrafficState | null): string {
  if (!state) return '';
  if (state.isLive) {
    const time = state.measuredAt?.split(' ')[1] ?? '';
    return `live readings${time ? ` · ${time} IST` : ''}`;
  }
  return `typical for ${String(state.hour).padStart(2, '0')}:00 IST`;
}

export function corridorTone(factor: number): string {
  if (factor < 1.12) return '#4E7A4B';
  if (factor < 1.4) return '#B17D2F';
  if (factor < 1.85) return '#C2542E';
  return '#A44551';
}

export function corridorFactor(corridor: Corridor, state: TrafficState): number {
  return Math.max(0.8, Math.min(2.4, corridor.freeKmph / Math.max(4, speedNow(corridor, state))));
}

/** Current speed on a corridor, live reading first, baked hourly profile second. */
export function corridorKmph(corridor: Corridor, state: TrafficState): number {
  return speedNow(corridor, state);
}
