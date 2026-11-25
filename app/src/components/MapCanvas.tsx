import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, MapMouseEvent, GeoJSONSource } from 'maplibre-gl';
import { CATEGORIES, categoryColor } from '../lib/catalog';
import {
  circleBounds,
  circlePolygon,
  collection,
  pointFeature,
  type FeatureCollection,
  type LineFeature,
  type PointFeature,
} from '../lib/geo';
import {
  corridorFactor,
  corridorTone,
  type TrafficState,
} from '../lib/traffic';
import type {
  Area,
  CategoryId,
  Origin,
  Place,
  ResultRow,
  Theme,
  Trail,
  TrailStop,
} from '../lib/types';

interface MapCanvasProps {
  results: ResultRow[];
  areas: Area[];
  origin: Origin;
  radiusKm: number;
  selected: Place | null;
  trail: Trail | null;
  theme: Theme;
  traffic: TrafficState | null;
  pickMode: boolean;
  onSelectPlace: (place: Place) => void;
  onSelectArea: (area: Area) => void;
  onSelectTrailStop: (trail: Trail, stop: TrailStop, index: number) => void;
  onPick: (point: { lat: number; lon: number }) => void;
}

interface Palette {
  halo: string;
  areaLabel: string;
  radius: string;
  accent: string;
  ink: string;
  cluster: string;
  clusterText: string;
  clusterStroke: string;
  markerStroke: string;
  cat: Record<CategoryId, string>;
}

interface LayerMouseEvent extends MapMouseEvent {
  features?: Array<{
    properties?: Record<string, unknown> | null;
    geometry?: { type: string; coordinates: unknown };
  }>;
}

function paletteFor(theme: Theme): Palette {
  const cat = Object.fromEntries(
    CATEGORIES.map((category) => [category.id, categoryColor(category.id, theme)]),
  ) as Record<CategoryId, string>;

  if (theme === 'dark') {
    return {
      halo: '#0E100C',
      areaLabel: '#9C9480',
      radius: '#E27A4E',
      accent: '#E27A4E',
      ink: '#EDE6D6',
      cluster: '#EDE6D6',
      clusterText: '#151A12',
      clusterStroke: '#0E100C',
      markerStroke: '#0E100C',
      cat,
    };
  }
  return {
    halo: '#F3EDE2',
    areaLabel: '#6E6654',
    radius: '#C2542E',
    accent: '#C2542E',
    ink: '#1F2A1E',
    cluster: '#FBF6EC',
    clusterText: '#26301F',
    clusterStroke: '#26301F',
    markerStroke: '#F8F2E7',
    cat,
  };
}

function styleUrl(theme: Theme): string {
  return theme === 'dark' ? 'map/dark.json' : 'map/light.json';
}

function categoryExpression(palette: Palette): unknown {
  const expression: unknown[] = ['match', ['get', 'cat']];
  for (const category of CATEGORIES) {
    expression.push(category.id, palette.cat[category.id]);
  }
  expression.push('#8A8272');
  return expression;
}

function ensureSource(map: MapLibreMap, id: string, source: unknown): void {
  if (!map.getSource(id)) {
    map.addSource(id, source as never);
  }
}

function ensureLayer(map: MapLibreMap, layer: Record<string, unknown>): void {
  if (!map.getLayer(layer.id as string)) {
    map.addLayer(layer as never);
  }
}

function installOverlays(
  map: MapLibreMap,
  state: {
    placesGeo: FeatureCollection<PointFeature>;
    areasGeo: FeatureCollection<PointFeature>;
    originGeo: FeatureCollection<PointFeature>;
    selectedGeo: FeatureCollection<PointFeature>;
    trailLine: FeatureCollection<LineFeature>;
    trailStops: FeatureCollection<PointFeature>;
    radius: ReturnType<typeof circlePolygon>;
    palette: Palette;
  },
): void {
  const { palette } = state;
  const emptyLine: FeatureCollection<LineFeature> = collection([]);
  const emptyPoints: FeatureCollection<PointFeature> = collection([]);

  ensureSource(map, 'areas', {
    type: 'geojson',
    data: state.areasGeo,
  });
  ensureSource(map, 'radius', {
    type: 'geojson',
    data: state.radius,
  });
  ensureSource(map, 'trail-line', {
    type: 'geojson',
    data: state.trailLine.features.length ? state.trailLine : emptyLine,
  });
  ensureSource(map, 'trail-stops', {
    type: 'geojson',
    data: state.trailStops.features.length ? state.trailStops : emptyPoints,
  });
  ensureSource(map, 'places', {
    type: 'geojson',
    data: state.placesGeo,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 46,
  });
  ensureSource(map, 'selected', {
    type: 'geojson',
    data: state.selectedGeo,
  });
  ensureSource(map, 'origin', {
    type: 'geojson',
    data: state.originGeo,
  });

  ensureLayer(map, {
    id: 'radius-fill',
    type: 'fill',
    source: 'radius',
    paint: {
      'fill-color': palette.radius,
      'fill-opacity': 0.055,
    },
  });
  ensureLayer(map, {
    id: 'radius-line',
    type: 'line',
    source: 'radius',
    paint: {
      'line-color': palette.radius,
      'line-width': 1.3,
      'line-opacity': 0.55,
      'line-dasharray': [2, 2],
    },
  });
  ensureLayer(map, {
    id: 'trail-casing',
    type: 'line',
    source: 'trail-line',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': palette.halo,
      'line-width': 7,
      'line-opacity': 0.7,
    },
  });
  ensureLayer(map, {
    id: 'trail-line',
    type: 'line',
    source: 'trail-line',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['coalesce', ['get', 'color'], palette.ink],
      'line-width': 2.6,
      'line-opacity': 0.92,
      'line-dasharray': [0.7, 1.6],
    },
  });
  ensureLayer(map, {
    id: 'areas-dots',
    type: 'circle',
    source: 'areas',
    paint: {
      'circle-color': palette.areaLabel,
      'circle-radius': 2,
      'circle-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10,
        0,
        11.5,
        0.42,
        14,
        0.18,
      ],
    },
  });
  ensureLayer(map, {
    id: 'areas-labels',
    type: 'symbol',
    source: 'areas',
    minzoom: 9.8,
    maxzoom: 14.9,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10,
        9,
        13,
        10.5,
        14.5,
        12,
      ],
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.14,
      'text-max-width': 8,
      'text-padding': 7,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': palette.areaLabel,
      'text-halo-color': palette.halo,
      'text-halo-width': 2.4,
      'text-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10,
        0.5,
        13,
        0.78,
        14.2,
        0.55,
        14.9,
        0,
      ],
    },
  });
  ensureLayer(map, {
    id: 'trail-stops-circles',
    type: 'circle',
    source: 'trail-stops',
    paint: {
      'circle-color': palette.halo,
      'circle-radius': 11.5,
      'circle-stroke-color': palette.ink,
      'circle-stroke-width': 1.4,
      'circle-stroke-opacity': 0.8,
    },
  });
  ensureLayer(map, {
    id: 'trail-stops-labels',
    type: 'symbol',
    source: 'trail-stops',
    layout: {
      'text-field': ['get', 'n'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 10.5,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': palette.ink,
    },
  });
  ensureLayer(map, {
    id: 'places-clusters',
    type: 'circle',
    source: 'places',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': palette.cluster,
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        18,
        10,
        23,
        50,
        29,
        200,
        36,
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': palette.clusterStroke,
      'circle-stroke-opacity': 0.5,
      'circle-opacity': 0.97,
    },
  });
  ensureLayer(map, {
    id: 'places-cluster-count',
    type: 'symbol',
    source: 'places',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': [
        'step',
        ['get', 'point_count'],
        10.5,
        100,
        11.5,
        1000,
        12.5,
      ],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': palette.clusterText,
    },
  });
  ensureLayer(map, {
    id: 'places-points',
    type: 'circle',
    source: 'places',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': categoryExpression(palette) as never,
      'circle-radius': ['case', ['get', 'curated'], 6.2, 3.6],
      'circle-stroke-width': 1.2,
      'circle-stroke-color': palette.markerStroke,
      'circle-opacity': 0.94,
    },
  });
  ensureLayer(map, {
    id: 'places-curated-ring',
    type: 'circle',
    source: 'places',
    filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'curated'], true]],
    paint: {
      'circle-color': 'transparent',
      'circle-radius': 10,
      'circle-stroke-width': 1,
      'circle-stroke-color': palette.ink,
      'circle-stroke-opacity': 0.24,
    },
  });
  ensureLayer(map, {
    id: 'places-labels',
    type: 'symbol',
    source: 'places',
    minzoom: 13.8,
    filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'curated'], true]],
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 10.5,
      'text-max-width': 9,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-optional': true,
      'text-padding': 3,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': palette.ink,
      'text-halo-color': palette.halo,
      'text-halo-width': 2,
      'text-opacity': 0.88,
    },
  });
  ensureLayer(map, {
    id: 'selected-halo',
    type: 'circle',
    source: 'selected',
    paint: {
      'circle-color': palette.accent,
      'circle-radius': 17,
      'circle-opacity': 0.14,
      'circle-stroke-color': palette.accent,
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.35,
    },
  });
  ensureLayer(map, {
    id: 'selected-dot',
    type: 'circle',
    source: 'selected',
    paint: {
      'circle-color': palette.accent,
      'circle-radius': 5.5,
      'circle-stroke-color': palette.halo,
      'circle-stroke-width': 2,
    },
  });
  ensureLayer(map, {
    id: 'origin-dot',
    type: 'circle',
    source: 'origin',
    paint: {
      'circle-color': palette.accent,
      'circle-radius': 8,
      'circle-opacity': 0.16,
      'circle-stroke-color': palette.accent,
      'circle-stroke-width': 1.5,
      'circle-stroke-opacity': 0.75,
    },
  });
}

export default function MapCanvas({
  results,
  areas,
  origin,
  radiusKm,
  selected,
  trail,
  theme,
  traffic,
  pickMode,
  onSelectPlace,
  onSelectArea,
  onSelectTrailStop,
  onPick,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const markerLabelRef = useRef<HTMLSpanElement | null>(null);
  const viewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const [ready, setReady] = useState(false);
  const lastRadiusKey = useRef('');

  const placesGeo = useMemo<FeatureCollection<PointFeature>>(
    () =>
      collection(
        results.map(({ place }) =>
          pointFeature(place, {
            id: place.id,
            name: place.name,
            cat: place.cat,
            curated: Boolean(place.curated),
            score: place.score,
          }),
        ),
      ),
    [results],
  );

  const lookup = useMemo(
    () => new Map(results.map(({ place }) => [place.id, place])),
    [results],
  );

  const areasGeo = useMemo<FeatureCollection<PointFeature>>(
    () =>
      collection(
        areas.map((area) =>
          pointFeature(area, {
            id: area.id,
            name: area.name,
            rank: area.bestFor.length,
          }),
        ),
      ),
    [areas],
  );

  const selectedGeo = useMemo<FeatureCollection<PointFeature>>(
    () =>
      collection(
        selected
          ? [
              pointFeature(selected, {
                id: selected.id,
                name: selected.name,
              }),
            ]
          : [],
      ),
    [selected],
  );

  const originGeo = useMemo<FeatureCollection<PointFeature>>(
    () =>
      collection([
        pointFeature(origin, {
          id: origin.id,
          name: origin.name,
        }),
      ]),
    [origin],
  );

  const radiusGeo = useMemo(
    () => circlePolygon(origin, radiusKm),
    [origin, radiusKm],
  );

  const trailLine = useMemo<FeatureCollection<LineFeature>>(
    () =>
      collection(
        trail
          ? [
              {
                type: 'Feature' as const,
                properties: { color: trail.color },
                geometry: {
                  type: 'LineString' as const,
                  coordinates: trail.stops.map((stop) => [stop.lon, stop.lat] as [number, number]),
                },
              },
            ]
          : [],
      ),
    [trail],
  );

  const trailStops = useMemo<FeatureCollection<PointFeature>>(
    () =>
      collection(
        trail
          ? trail.stops.map((stop, index) =>
              pointFeature(stop, {
                n: String(index + 1).padStart(2, '0'),
                name: stop.name,
                cat: stop.cat,
                trailId: trail.id,
                index,
              }),
            )
          : [],
      ),
    [trail],
  );

  const trafficGeo = useMemo<FeatureCollection<LineFeature>>(() => {
    if (!traffic?.model) return collection([]);
    return collection(
      traffic.model.corridors.map((corridor) => ({
        type: 'Feature' as const,
        properties: {
          tone: corridorTone(corridorFactor(corridor, traffic)),
          name: corridor.name,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: corridor.path,
        },
      })),
    );
  }, [traffic]);

  const palette = useMemo(() => paletteFor(theme), [theme]);

  const stateRef = useRef({
    placesGeo,
    areasGeo,
    originGeo,
    selectedGeo,
    radius: radiusGeo,
    trailLine,
    trailStops,
    palette,
    lookup,
    areas,
    trail,
    pickMode,
  });
  stateRef.current = {
    placesGeo,
    areasGeo,
    originGeo,
    selectedGeo,
    radius: radiusGeo,
    trailLine,
    trailStops,
    palette,
    lookup,
    areas,
    trail,
    pickMode,
  };

  const handlersRef = useRef({ onSelectPlace, onSelectArea, onSelectTrailStop, onPick });
  handlersRef.current = { onSelectPlace, onSelectArea, onSelectTrailStop, onPick };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const savedView = viewRef.current;
    const map = new maplibregl.Map({
      container,
      style: styleUrl(theme),
      center: savedView?.center ?? [77.5946, 12.9716],
      zoom: savedView?.zoom ?? 11.4,
      minZoom: 9.5,
      maxZoom: 18,
      renderWorldCopies: false,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'bottom-left',
    );
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-left');
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    const saveView = () => {
      viewRef.current = {
        center: [map.getCenter().lng, map.getCenter().lat],
        zoom: map.getZoom(),
      };
    };
    map.on('moveend', saveView);

    map.on('load', () => {
      installOverlays(map, stateRef.current);

      const element = document.createElement('div');
      element.className = 'map-origin-marker';
      const dot = document.createElement('span');
      dot.className = 'map-origin-dot';
      const label = document.createElement('span');
      label.className = 'map-origin-label';
      label.textContent = stateRef.current.originGeo.features[0]?.properties.name
        ? String(stateRef.current.originGeo.features[0].properties.name)
        : '';
      element.append(dot, label);
      markerLabelRef.current = label;
      markerRef.current = new maplibregl.Marker({ element, anchor: 'center' })
        .setLngLat([origin.lon, origin.lat])
        .addTo(map);

      setReady(true);
    });

    const mapClick = (event: MapMouseEvent) => {
      if (stateRef.current.pickMode) {
        handlersRef.current.onPick({
          lat: event.lngLat.lat,
          lon: event.lngLat.lng,
        });
      }
    };
    map.on('click', mapClick);

    map.on('click', 'places-clusters', (raw) => {
      const event = raw as LayerMouseEvent;
      const feature = event.features?.[0];
      const clusterId = Number(feature?.properties?.cluster_id);
      const coordinates = (feature?.geometry as { coordinates?: [number, number] })?.coordinates;
      if (!Number.isFinite(clusterId) || !coordinates) return;
      const source = map.getSource('places') as GeoJSONSource;
      source
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          map.easeTo({
            center: coordinates,
            zoom: Math.min(17.5, zoom + 0.2),
            duration: 650,
          });
        })
        .catch(() => undefined);
    });

    map.on('click', 'places-points', (raw) => {
      const event = raw as LayerMouseEvent;
      const id = String(event.features?.[0]?.properties?.id || '');
      const place = stateRef.current.lookup.get(id);
      if (place) handlersRef.current.onSelectPlace(place);
    });

    map.on('click', 'trail-stops-circles', (raw) => {
      const event = raw as LayerMouseEvent;
      const properties = event.features?.[0]?.properties;
      if (!properties) return;
      const index = Number(properties.index);
      const trailId = String(properties.trailId || '');
      const current = stateRef.current.trail;
      if (current && current.id === trailId && current.stops[index]) {
        handlersRef.current.onSelectTrailStop(current, current.stops[index], index);
      }
    });

    map.on('click', 'areas-labels', (raw) => {
      const event = raw as LayerMouseEvent;
      const id = String(event.features?.[0]?.properties?.id || '');
      const area = stateRef.current.areas.find((candidate) => candidate.id === id);
      if (area) handlersRef.current.onSelectArea(area);
    });

    const interactiveLayers = [
      'places-points',
      'places-clusters',
      'trail-stops-circles',
      'areas-labels',
    ];
    for (const layer of interactiveLayers) {
      map.on('mouseenter', layer, () => {
        if (!stateRef.current.pickMode) map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        if (!stateRef.current.pickMode) map.getCanvas().style.cursor = '';
      });
    }

    return () => {
      saveView();
      markerRef.current = null;
      markerLabelRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // Recreate the map when the theme changes so the custom map style and its
    // overlays are installed together, cleanly, on a fresh style.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('places') as GeoJSONSource | undefined;
    source?.setData(stateRef.current.placesGeo as never);
  }, [placesGeo, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('radius') as GeoJSONSource | undefined;
    source?.setData(stateRef.current.radius as never);
  }, [radiusGeo, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource('selected') as GeoJSONSource | undefined;
    source?.setData(stateRef.current.selectedGeo as never);
  }, [selectedGeo, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const line = map.getSource('trail-line') as GeoJSONSource | undefined;
    const stops = map.getSource('trail-stops') as GeoJSONSource | undefined;
    line?.setData(stateRef.current.trailLine as never);
    stops?.setData(stateRef.current.trailStops as never);
  }, [trailLine, trailStops, ready]);

  const shownTrailRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (trail && trail.stops.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      for (const stop of trail.stops) bounds.extend([stop.lon, stop.lat]);
      map.fitBounds(bounds, {
        padding: { top: 96, bottom: 96, left: 72, right: 72 },
        maxZoom: 14.6,
        duration: 750,
      });
    } else if (shownTrailRef.current) {
      map.easeTo({ center: [origin.lon, origin.lat], zoom: 13.2, duration: 650 });
    }
    shownTrailRef.current = trail?.id ?? null;
  }, [trail, ready, origin.lon, origin.lat]);

  // Live congestion ribbons, drawn under the pins so they read as road texture.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const before = map.getLayer('radius-fill') ? 'radius-fill' : undefined;
    if (!map.getSource('traffic')) {
      map.addSource('traffic', { type: 'geojson', data: trafficGeo });
    }
    if (!map.getLayer('traffic-glow')) {
      map.addLayer(
        {
          id: 'traffic-glow',
          type: 'line',
          source: 'traffic',
          layout: { 'line-cap': 'round', 'line-join': 'round', visibility: traffic ? 'visible' : 'none' },
          paint: {
            'line-color': ['get', 'tone'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 14],
            'line-opacity': 0.16,
            'line-blur': 4,
          },
        },
        before,
      );
    }
    if (!map.getLayer('traffic-line')) {
      map.addLayer(
        {
          id: 'traffic-line',
          type: 'line',
          source: 'traffic',
          layout: { 'line-cap': 'round', 'line-join': 'round', visibility: traffic ? 'visible' : 'none' },
          paint: {
            'line-color': ['get', 'tone'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 14, 4.4],
            'line-opacity': 0.72,
          },
        },
        before,
      );
    }
    const source = map.getSource('traffic') as GeoJSONSource | undefined;
    source?.setData(trafficGeo as never);
    for (const id of ['traffic-glow', 'traffic-line']) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', traffic ? 'visible' : 'none');
      }
    }
  }, [trafficGeo, traffic, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const label = markerLabelRef.current;
    if (label) label.textContent = origin.name;
    markerRef.current?.setLngLat([origin.lon, origin.lat]);
    const source = map.getSource('origin') as GeoJSONSource | undefined;
    source?.setData(stateRef.current.originGeo as never);
  }, [origin, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const interactive = !pickMode && !trail;
    const visibility = interactive ? 'visible' : 'none';
    for (const layer of [
      'places-clusters',
      'places-cluster-count',
      'places-points',
      'places-curated-ring',
      'places-labels',
      'areas-dots',
      'areas-labels',
    ]) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, 'visibility', visibility);
      }
    }
    const trailVisibility = trail && !pickMode ? 'visible' : 'none';
    for (const layer of ['trail-casing', 'trail-line', 'trail-stops-circles', 'trail-stops-labels']) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, 'visibility', trailVisibility);
      }
    }
    const radiusVisibility = trail ? 'none' : 'visible';
    for (const layer of ['radius-fill', 'radius-line']) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, 'visibility', radiusVisibility);
      }
    }
    const selectedVisibility = pickMode ? 'none' : 'visible';
    for (const layer of ['selected-halo', 'selected-dot']) {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, 'visibility', selectedVisibility);
      }
    }
    map.getCanvas().style.cursor = pickMode ? 'crosshair' : '';
  }, [pickMode, trail, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (selected) {
      const wide = window.innerWidth >= 1000;
      const narrow = window.innerWidth < 900;
      map.easeTo({
        center: [selected.lon, selected.lat],
        zoom: Math.min(16.5, Math.max(map.getZoom(), narrow ? 14.6 : 15.2)),
        padding: {
          top: narrow ? 60 : 90,
          bottom: narrow ? Math.round(window.innerHeight * 0.5) : 110,
          left: narrow ? 30 : 40,
          right: wide ? 400 : narrow ? 30 : 40,
        },
        duration: 800,
      });
    }
  }, [selected, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (selected || trail) return;
    const key = `${origin.lat.toFixed(4)},${origin.lon.toFixed(4)},${radiusKm.toFixed(2)}`;
    if (lastRadiusKey.current === key) return;
    const firstFit = !lastRadiusKey.current;
    lastRadiusKey.current = key;
    const narrow = window.innerWidth < 900;
    map.fitBounds(circleBounds(origin, radiusKm), {
      padding: narrow
        ? {
            top: 44,
            bottom: Math.round(window.innerHeight * 0.46),
            left: 24,
            right: 24,
          }
        : { top: 80, bottom: 110, left: 50, right: 50 },
      maxZoom: 15.2,
      duration: firstFit ? 0 : 800,
    });
  }, [origin, radiusKm, selected, trail, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !trail) return;
    const lons = trail.stops.map((stop) => stop.lon);
    const lats = trail.stops.map((stop) => stop.lat);
    const narrow = window.innerWidth < 900;
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      {
        padding: narrow
          ? {
              top: 50,
              bottom: Math.round(window.innerHeight * 0.46),
              left: 24,
              right: 24,
            }
          : { top: 100, bottom: 140, left: 60, right: 60 },
        maxZoom: narrow ? 13.6 : 14.2,
        duration: 900,
      },
    );
  }, [trail, ready]);

  return (
    <>
      <div
        className="map-canvas"
        ref={containerRef}
        role="region"
        aria-label="Map of Bengaluru places"
      />
      <div className={`map-veil ${ready ? 'is-ready' : ''}`} aria-hidden="true">
        <span className="map-veil-ring" />
        <span className="eyebrow">Drawing the city</span>
      </div>
      <div className="map-credit">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
        {' · '}
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>
      </div>
    </>
  );
}
