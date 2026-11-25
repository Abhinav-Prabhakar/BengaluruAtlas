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
}

export interface WeatherNow {
  temp: number;
  code: number;
  rainChance: number;
  sunset: string;
  golden: boolean;
  label: string;
}
