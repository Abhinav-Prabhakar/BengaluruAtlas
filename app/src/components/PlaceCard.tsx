import { useState, type CSSProperties } from 'react';
import { Bookmark, Check, Star } from 'lucide-react';
import { CATEGORY_BY_ID, categoryColor } from '../lib/catalog';
import { formatDistance } from '../lib/geo';
import { describePlace } from '../lib/places';
import type { Place, ResultRow, Theme } from '../lib/types';

interface PlaceCardProps {
  row: ResultRow;
  theme: Theme;
  saved: boolean;
  visited: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
}

function seedOf(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 360;
  }
  return hash;
}

function Thumb({ place, theme }: { place: Place; theme: Theme }) {
  const [failed, setFailed] = useState(false);
  const meta = CATEGORY_BY_ID[place.cat];
  const Icon = meta.icon;
  const seed = seedOf(place.name);
  const style = {
    '--cat': categoryColor(place.cat, theme),
    '--seed': seed,
  } as CSSProperties;

  if (place.img && !failed) {
    return (
      <span className="place-thumb has-image" style={style}>
        <img
          src={place.img}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
        <span className="thumb-badge">
          <Icon size={11} strokeWidth={2} />
        </span>
      </span>
    );
  }

  return (
    <span className="place-thumb is-poster" style={style} aria-hidden="true">
      <span className="poster-rings" />
      <Icon className="poster-icon" size={30} strokeWidth={1.1} />
      <span className="poster-area">{place.area}</span>
    </span>
  );
}

export default function PlaceCard({
  row,
  theme,
  saved,
  visited,
  selected,
  onSelect,
  onToggleSave,
}: PlaceCardProps) {
  const { place, minutes, distanceKm } = row;
  const meta = CATEGORY_BY_ID[place.cat];
  const Icon = meta.icon;
  const color = categoryColor(place.cat, theme);
  const style = { '--cat': color } as CSSProperties;
  const note = place.note ? describePlace(place) : null;
  const tags = (place.tags || [])
    .filter((tag) => tag.toLowerCase() !== meta.label.toLowerCase())
    .slice(0, 3);

  return (
    <li className={`place-card ${selected ? 'is-selected' : ''}`} style={style}>
      <button
        type="button"
        className="place-card-open"
        onClick={onSelect}
        aria-label={`${place.name}, ${place.sub} in ${place.area}`}
      >
        <Thumb place={place} theme={theme} />
        <span className="place-body">
          <span className="place-name">{place.name}</span>
          <span className="place-meta">
            {place.curated && (
              <span className="place-pick">
                <Star size={9} fill="currentColor" /> pick
              </span>
            )}
            <span>
              {place.sub} · {place.area}
            </span>
          </span>
          {note ? (
            <span className="place-note">{note}</span>
          ) : (
            tags.length > 0 && (
              <span className="place-tags">
                {tags.map((tag) => (
                  <i key={tag}>{tag}</i>
                ))}
              </span>
            )
          )}
          <span className="place-foot">
            <span className="place-cat">
              <Icon size={11} strokeWidth={2} />
              {meta.label}
            </span>
            <span className={`place-time ${row.live ? 'is-live' : ''}`}>
              {row.live && <i className="live-dot" aria-hidden="true" />}≈ {minutes} min
            </span>
            <span className="place-distance">{formatDistance(distanceKm)}</span>
            {place.gem && <span className="place-gem">gem</span>}
            {visited && (
              <span className="place-visited">
                <Check size={10} /> been
              </span>
            )}
          </span>
        </span>
      </button>
      <button
        type="button"
        className={`card-save ${saved ? 'is-saved' : ''}`}
        onClick={onToggleSave}
        aria-label={saved ? `Remove ${place.name} from saved` : `Save ${place.name}`}
        aria-pressed={saved}
        title={saved ? 'Saved' : 'Save for later'}
      >
        <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
      </button>
    </li>
  );
}
