export type CategoryId =
  | 'eat'
  | 'coffee'
  | 'outdoors'
  | 'culture'
  | 'worship'
  | 'shop'
  | 'stay'
  | 'experience';

export type TravelMode = 'walk' | 'bike' | 'auto' | 'cab';

export type Theme = 'light' | 'dark';

export type ThemePref = 'system' | 'light' | 'dark';

export type TabId = 'places' | 'trails' | 'saved';

export type OriginKind = 'area' | 'pin' | 'geo';

export interface Place {
  id: string;
  name: string;
  cat: CategoryId;
  sub: string;
  lat: number;
  lon: number;
  area: string;
  note?: string | null;
  why?: string[];
  mustTry?: string | null;
  bestTime?: string | null;
  price?: string | null;
  diet?: string | null;
  tags?: string[];
  addr?: string;
  hours?: string | null;
  web?: string | null;
  phone?: string | null;
  wiki?: string | null;
  wd?: string | null;
  osm?: string | null;
  img?: string | null;
  imgPage?: string | null;
  imgCredit?: string | null;
  imgLicense?: string | null;
  /** `area` means the photo shows the neighbourhood, not the place itself. */
  imgScope?: 'place' | 'area' | null;
  score: number;
  chain?: boolean;
  gem?: boolean;
  curated?: boolean;
  tier?: 'editor' | 'wiki' | 'atlas' | null;
  seasonal?: string | null;
  /** A trail stop that has no matching entry in the place index. */
  synthetic?: boolean;
}

export interface Area {
  id: string;
  name: string;
  lat: number;
  lon: number;
  zoom: number;
  blurb: string;
  vibe: string[];
  bestFor: CategoryId[];
}

export interface TrailStop {
  key?: string | null;
  name: string;
  lat: number;
  lon: number;
  cat: CategoryId;
  note: string;
  id?: string | null;
}

export interface Trail {
  id: string;
  title: string;
  kicker: string;
  note: string;
  kind: 'walk' | 'daytrip' | string;
  duration: string;
  distance: string;
  bestTime: string;
  color: string;
  stops: TrailStop[];
  area?: string;
  theme?: string;
  tags?: string[];
  img?: string | null;
  imgPage?: string | null;
  imgCredit?: string | null;
  imgLicense?: string | null;
  imgScope?: 'place' | 'area' | null;
}

export interface AtlasMeta {
  generated: string;
  total: number;
  curated: number;
  areas: number;
  counts: Record<CategoryId, number>;
  bbox: [number, number, number, number];
  sources: string[];
}

export interface Atlas {
  meta: AtlasMeta;
  areas: Area[];
  places: Place[];
  trails: Trail[];
}

export interface Origin {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: OriginKind;
  areaId?: string;
}

export interface ResultRow {
  place: Place;
  distanceKm: number;
  minutes: number;
  /** True when the time came from a real road route, not a straight-line estimate. */
  live?: boolean;
  traffic?: 'light' | 'moving' | 'heavy' | 'gridlock';
  kmph?: number;
  /** Free-flow speed of the nearest instrumented corridor. */
  freeKmph?: number;
  /** Opening status at the moment this row says you would arrive. */
  arrival?: ArrivalInfo | null;
}

export interface WeatherNow {
  temp: number;
  code: number;
  /** Highest rain chance over the next few hours, used by the weather chip. */
  rainChance: number;
  /** Rain chance for the current hour and the next one. */
  rainSoonChance: number;
  /** Highest rain chance after the soon window. */
  rainLaterChance: number;
  /** First later hour with a likely shower, as an ISO-ish timestamp. */
  rainLaterAt: string | null;
  /** Same moment as minutes since midnight, for quiet comparisons. */
  rainLaterMinute: number | null;
  /** Rain is falling now, or the current code says it is. */
  rainNow: boolean;
  sunset: string;
  golden: boolean;
  label: string;
}

export interface ArrivalInfo {
  state: 'open' | 'closed' | 'unknown';
  /** Minutes until closing; null when closed or unknown. */
  closesIn: number | null;
  /** Clock minute when it closes; may exceed 1440 for tomorrow. */
  closesAt: number | null;
  /** Clock minute when it next opens; may exceed 1440 for tomorrow. */
  opensAt: number | null;
  closingSoon: boolean;
  /** Arrival time, minutes since midnight of the arrival day. */
  arrivalAt: number;
}
