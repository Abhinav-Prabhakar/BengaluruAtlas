import { useState, type CSSProperties } from 'react';
import { Bookmark, Check, Star } from 'lucide-react';
import { CATEGORY_BY_ID, categoryColor } from '../lib/catalog';
import { formatDistance } from '../lib/geo';
import { arrivalNote, formatArrivalClock } from '../lib/hours';
import { describePlace } from '../lib/places';
import type { Place, ResultRow, Theme } from '../lib/types';
import CoverArt, { coverSeed } from './CoverArt';

interface PlaceCardProps {
  row: ResultRow;
  theme: Theme;
  saved: boolean;
  visited: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
}

function Thumb({ place, theme }: { place: Place; theme: Theme }) {
  const [failed, setFailed] = useState(false);
  const meta = CATEGORY_BY_ID[place.cat];
  const Icon = meta.icon;
  const seed = coverSeed(place.name);
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
        {place.imgScope === 'area' && (
          <span className="thumb-scope">area</span>
        )}
      </span>
    );
  }

  return (
    <span className="place-thumb is-poster" style={style} aria-hidden="true">
      <CoverArt cat={place.cat} seed={seed} className="poster-art" />
      <span className="poster-icon-badge">
        <Icon size={11} strokeWidth={2.1} />
      </span>
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
  const hoursNote = arrivalNote(row.arrival ?? null);
  const arrivalTitle =
    row.arrival?.state === 'closed'
      ? `Closed when you arrive${
          row.arrival.opensAt != null
            ? `; opens ${formatArrivalClock(row.arrival.opensAt)}`
            : ''
        }`
      : row.arrival?.closingSoon
        ? `Closes ${formatArrivalClock(row.arrival.closesAt)} — you would arrive just before`
        : '';

  return (
    <li
      className={`place-card ${selected ? 'is-selected' : ''}`}
      style={style}
      data-place-id={place.id}
    >
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
            <span className="place-time">≈ {minutes} min</span>
            <span className="place-distance">{formatDistance(distanceKm)}</span>
            {hoursNote && (
              <span
                className={`place-hours ${row.arrival?.state === 'closed' ? 'is-closed' : ''}`}
                title={arrivalTitle}
              >
                {hoursNote}
              </span>
            )}
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
