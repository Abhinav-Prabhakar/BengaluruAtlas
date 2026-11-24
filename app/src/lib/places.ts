import type { Atlas, CategoryId, Place, Trail, TrailStop } from './types';
import { nearestArea } from './geo';

export function buildPlaceIndex(atlas: Atlas): Map<string, Place> {
  return new Map(atlas.places.map((place) => [place.id, place]));
}

export function syntheticStopId(trailId: string, index: number): string {
  return `trail-stop:${trailId}:${index}`;
}

const DAY_TRIP_AREAS = new Set([
  'nandi',
  'mysore',
  'rocks',
  'arts',
]);

function stopArea(trail: Trail, stop: TrailStop, atlas: Atlas): string {
  if (trail.kind === 'daytrip' || DAY_TRIP_AREAS.has(trail.id.replace('daytrip-', ''))) {
    return 'Day trip';
  }
  return nearestArea(atlas.areas, stop).name;
}

export function placeForTrailStop(
  trail: Trail,
  stop: TrailStop,
  index: number,
  atlas: Atlas,
  places: Map<string, Place>,
): Place {
  if (stop.id) {
    const existing = places.get(stop.id);
    if (existing) return existing;
  }
  return {
    id: stop.id || syntheticStopId(trail.id, index),
    name: stop.name,
    cat: stop.cat,
    sub: trail.kind === 'daytrip' ? 'Day-trip stop' : 'Walk stop',
    lat: stop.lat,
    lon: stop.lon,
    area: stopArea(trail, stop, atlas),
    note: stop.note,
    why: [],
    tags: [],
    score: 100,
    curated: true,
    gem: false,
    synthetic: true,
  };
}

export function resolvePlaceId(
  atlas: Atlas,
  places: Map<string, Place>,
  id: string,
): Place | null {
  const direct = places.get(id);
  if (direct) return direct;
  for (const trail of atlas.trails) {
    const index = trail.stops.findIndex(
      (stop, stopIndex) => (stop.id || syntheticStopId(trail.id, stopIndex)) === id,
    );
    if (index >= 0) {
      return placeForTrailStop(trail, trail.stops[index], index, atlas, places);
    }
  }
  return null;
}

export function placeHaystack(place: Place): string {
  return [
    place.name,
    place.sub,
    place.area,
    place.note || '',
    place.mustTry || '',
    place.price || '',
    ...(place.tags || []),
    ...(place.why || []),
  ]
    .join(' ')
    .toLowerCase();
}

export function describePlace(place: Place): string {
  if (place.note) return place.note;
  if (place.synthetic) {
    return `A stop on this trail in ${place.area}.`;
  }
  return `A ${place.sub.toLowerCase()} in ${place.area}, picked up in the OpenStreetMap survey of the city.`;
}

export function placeFacts(place: Place): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  if (place.bestTime) facts.push({ label: 'Best time', value: place.bestTime });
  if (place.price) facts.push({ label: 'Price', value: place.price });
  if (place.hours) facts.push({ label: 'Hours', value: place.hours });
  if (place.diet) {
    const diets: Record<string, string> = {
      veg: 'Vegetarian',
      nonveg: 'Non-vegetarian',
      both: 'Veg & non-veg',
    };
    facts.push({ label: 'Menu', value: diets[place.diet] || place.diet });
  }
  return facts;
}

export function categoryCounts(
  counts: Record<CategoryId, number>,
  categories: CategoryId[],
): number {
  return categories.reduce((total, category) => total + (counts[category] || 0), 0);
}

export function googleMapsSearchUrl(place: Place): string {
  const query = `${place.name}, ${place.area === 'Day trip' ? 'Karnataka' : place.area + ', Bengaluru'}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function googleMapsDirectionsUrl(place: Place, travelmode: string): string {
  const destination = `${place.lat.toFixed(6)},${place.lon.toFixed(6)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${travelmode}`;
}
