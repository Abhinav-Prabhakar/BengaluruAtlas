import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowUpRight, Clock3, Footprints, MapPin, Route } from 'lucide-react';
import { CATEGORY_BY_ID, categoryColor } from '../lib/catalog';
import type { Theme, Trail, TrailStop } from '../lib/types';

interface TrailsPanelProps {
  trails: Trail[];
  activeTrail: Trail | null;
  theme: Theme;
  onSelectTrail: (trail: Trail) => void;
  onClearTrail: () => void;
  onSelectStop: (trail: Trail, stop: TrailStop, index: number) => void;
}

function kindLabel(trail: Trail): string {
  return trail.kind === 'daytrip' ? 'Day trip' : 'City walk';
}

export default function TrailsPanel({
  trails,
  activeTrail,
  theme,
  onSelectTrail,
  onClearTrail,
  onSelectStop,
}: TrailsPanelProps) {
  if (!activeTrail) {
    const walks = trails.filter((trail) => trail.kind !== 'daytrip').length;
    const trips = trails.length - walks;
    return (
      <div className="trails-panel">
        <div className="panel-intro">
          <p className="eyebrow">Routes we like</p>
          <h3>Wander with a thread.</h3>
          <p>
            {walks} city walks and {trips} day trips, stitched from the atlas.
            Trails ignore the travel window — they are for when you have an
            afternoon.
          </p>
        </div>
        <ul className="trail-list">
          {trails.map((trail) => (
            <li key={trail.id}>
              <button
                type="button"
                className="trail-card"
                onClick={() => onSelectTrail(trail)}
                style={{ '--trail': trail.color } as CSSProperties}
              >
                <span className="trail-swatch" />
                <span className="trail-card-body">
                  <span className="trail-card-top">
                    <span className="trail-kind">{kindLabel(trail)}</span>
                    <span className="trail-meta">
                      {trail.duration} · {trail.distance}
                    </span>
                  </span>
                  <strong>{trail.title}</strong>
                  <span className="trail-kicker">{trail.kicker}</span>
                  <span className="trail-stops-line">
                    {trail.stops.length} stops · best {trail.bestTime}
                  </span>
                </span>
                <ArrowUpRight size={16} className="trail-arrow" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const trail = activeTrail;
  return (
    <div className="trails-panel is-detail" style={{ '--trail': trail.color } as CSSProperties}>
      <button type="button" className="back-button" onClick={onClearTrail}>
        <ArrowLeft size={14} />
        All trails
      </button>

      <header className="trail-detail-head">
        <p className="eyebrow">
          <span className="trail-swatch is-inline" />
          {kindLabel(trail)}
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

      <ol className="trail-stop-list">
        {trail.stops.map((stop, index) => {
          const category = CATEGORY_BY_ID[stop.cat];
          const Icon = category.icon;
          const color = categoryColor(stop.cat, theme);
          return (
            <li key={stop.id || `${trail.id}-${index}`}>
              <button
                type="button"
                className="trail-stop"
                onClick={() => onSelectStop(trail, stop, index)}
              >
                <span className="stop-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="stop-body">
                  <span className="stop-top">
                    <strong>{stop.name}</strong>
                    <span className="stop-cat" style={{ color }}>
                      <Icon size={11} />
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
