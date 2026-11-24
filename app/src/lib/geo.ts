import { MODE_BY_ID } from './catalog';
import type { Area, TravelMode } from './types';

/** Real trips are not straight lines. This is a deliberate, honest fudge factor. */
export const ROAD_FACTOR = 1.28;

const EARTH_RADIUS_KM = 6371.0088;

export interface LatLon {
  lat: number;
  lon: number;
}

export type LngLatTuple = [number, number];

export interface PointFeature {
  type: 'Feature';
  properties: Record<string, string | number | boolean | null>;
  geometry: { type: 'Point'; coordinates: LngLatTuple };
}

export interface LineFeature {
  type: 'Feature';
  properties: Record<string, string | number | boolean | null>;
  geometry: { type: 'LineString'; coordinates: LngLatTuple[] };
}

export interface PolygonFeature {
  type: 'Feature';
  properties: Record<string, string | number | boolean | null>;
  geometry: { type: 'Polygon'; coordinates: LngLatTuple[][] };
}

export interface FeatureCollection<F> {
  type: 'FeatureCollection';
  features: F[];
}

const toRad = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** The straight-line radius reachable in the chosen time, before the road factor. */
export function reachKm(mode: TravelMode, minutes: number): number {
  const { speed, overhead } = MODE_BY_ID[mode];
  const movingMinutes = Math.max(0, minutes - overhead);
  return Math.max(0.12, (speed * movingMinutes) / 60 / ROAD_FACTOR);
}

/** A deliberately conservative estimate, not live traffic. */
export function estimateMinutes(km: number, mode: TravelMode): number {
  const { speed, overhead } = MODE_BY_ID[mode];
  return Math.max(1, Math.round(((km * ROAD_FACTOR) / speed) * 60 + overhead));
}

export function circlePolygon(
  center: LatLon,
  radiusKm: number,
  steps = 96,
): PolygonFeature {
  const coordinates: LngLatTuple[] = [];
  const latRad = toRad(center.lat);
  const angular = radiusKm / EARTH_RADIUS_KM;
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (i / steps) * Math.PI * 2;
    const lat = Math.asin(
      Math.sin(latRad) * Math.cos(angular) +
        Math.cos(latRad) * Math.sin(angular) * Math.cos(bearing),
    );
    const lon =
      toRad(center.lon) +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(latRad),
        Math.cos(angular) - Math.sin(latRad) * Math.sin(lat),
      );
    coordinates.push([((lon * 180) / Math.PI + 540) % 360 - 180, (lat * 180) / Math.PI]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coordinates] },
  };
}

export function circleBounds(
  center: LatLon,
  radiusKm: number,
): [number, number, number, number] {
  const pad = 1.12;
  const latDelta = (radiusKm * pad) / 110.574;
  const lonDelta =
    (radiusKm * pad) / (111.32 * Math.max(0.2, Math.cos(toRad(center.lat))));
  return [
    center.lon - lonDelta,
    center.lat - latDelta,
    center.lon + lonDelta,
    center.lat + latDelta,
  ];
}

export function nearestArea(areas: Area[], point: LatLon): Area {
  let best = areas[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const area of areas) {
    const distance = distanceKm(area, point);
    if (distance < bestDistance) {
      best = area;
      bestDistance = distance;
    }
  }
  return best;
}

export function pointFeature(
  point: LatLon,
  properties: PointFeature['properties'],
): PointFeature {
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
  };
}

export function collection<F>(features: F[]): FeatureCollection<F> {
  return { type: 'FeatureCollection', features };
}

const countFormatter = new Intl.NumberFormat('en-IN');

export function formatCount(value: number): string {
  return countFormatter.format(value);
}

export function formatDistance(km: number): string {
  if (km < 0.1) return 'under 100 m';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatCoords(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
}

export function minutesLabel(minutes: number): string {
  return `${minutes} min`;
}
