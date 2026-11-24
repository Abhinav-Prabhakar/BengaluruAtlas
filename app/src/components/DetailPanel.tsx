import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Clock3,
  ExternalLink,
  Globe2,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Star,
  X,
} from 'lucide-react';
import { CATEGORY_BY_ID, MODE_BY_ID, categoryColor } from '../lib/catalog';
import { formatCoords, formatDistance } from '../lib/geo';
import {
  describePlace,
  googleMapsDirectionsUrl,
  googleMapsSearchUrl,
  placeFacts,
} from '../lib/places';
import type { Place, Theme, TravelMode } from '../lib/types';

interface DetailPanelProps {
  place: Place;
  theme: Theme;
  mode: TravelMode;
  originName: string;
  distanceKm: number;
  minutes: number;
  saved: boolean;
  visited: boolean;
  onClose: () => void;
  onToggleSave: () => void;
  onToggleVisited: () => void;
  onShare: () => void;
}

function safeWebUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export default function DetailPanel({
  place,
  theme,
  mode,
  originName,
  distanceKm,
  minutes,
  saved,
  visited,
  onClose,
  onToggleSave,
  onToggleVisited,
  onShare,
}: DetailPanelProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setImgFailed(false);
  }, [place.id]);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, [place.id]);

  const category = CATEGORY_BY_ID[place.cat];
  const Icon = category.icon;
  const color = categoryColor(place.cat, theme);
  const style = { '--cat': color } as CSSProperties;
  const modeMeta = MODE_BY_ID[mode];
  const facts = placeFacts(place);
  const hasImage = Boolean(place.img) && !imgFailed;
  const webHref = safeWebUrl(place.web);
  const wikiHref = place.wiki
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(place.wiki.replace(/ /g, '_'))}`
    : null;
  const directionsHref = googleMapsDirectionsUrl(place, modeMeta.directions);
  const searchHref = googleMapsSearchUrl(place);

  return (
    <>
      <button
        type="button"
        className="detail-backdrop"
        aria-label="Close place details"
        onClick={onClose}
      />
      <aside
        className="detail-panel"
        style={style}
        aria-label={`${place.name} details`}
      >
        <div className={`detail-hero ${hasImage ? 'has-image' : ''}`}>
          {hasImage ? (
            <img
              src={place.img || ''}
              alt={place.name}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="detail-hero-art" aria-hidden="true">
              <span className="hero-ring hero-ring-a" />
              <span className="hero-ring hero-ring-b" />
              <Icon size={54} strokeWidth={1.15} />
              <span className="hero-coords">{formatCoords(place.lat, place.lon)}</span>
            </div>
          )}

          <div className="detail-badges">
            <span className="detail-badge">
              <Icon size={12} strokeWidth={2.1} />
              {category.full}
            </span>
            {place.curated && !place.synthetic && (
              <span className="detail-badge is-pick">
                <Star size={10} fill="currentColor" /> Editor’s pick
              </span>
            )}
            {place.gem && <span className="detail-badge is-gem">Hidden gem</span>}
          </div>

          <div className="detail-hero-actions">
            <button
              type="button"
              className="hero-button"
              onClick={onShare}
              aria-label="Copy a link to this place"
              title="Copy a link to this place"
            >
              <Share2 size={15} />
            </button>
            <button
              type="button"
              className="hero-button"
              onClick={onClose}
              aria-label="Close details"
              ref={closeRef}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="detail-scroll">
          <div className="detail-head">
            <p className="eyebrow">
              {place.area}
              <span className="eyebrow-dot">·</span>
              {place.sub}
            </p>
            <h2>{place.name}</h2>
            <p className="detail-travel">
              <Navigation size={13} />
              <span>
                ≈ {minutes} min {modeMeta.label.toLowerCase()} ·{' '}
                {formatDistance(distanceKm)} from {originName}
              </span>
            </p>
          </div>

          <p className="detail-note">{describePlace(place)}</p>

          {place.why && place.why.length > 0 && (
            <div className="why-row">
              {place.why.map((reason) => (
                <span className="why-chip" key={reason}>
                  {reason}
                </span>
              ))}
            </div>
          )}

          {place.mustTry && (
            <div className="must-try">
              <span className="eyebrow">If you go, try</span>
              <p>{place.mustTry}</p>
            </div>
          )}

          {facts.length > 0 && (
            <dl className="detail-facts">
              {facts.map((fact) => (
                <div className="fact" key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {place.addr && (
            <p className="detail-address">
              <MapPin size={14} />
              <span>{place.addr}</span>
            </p>
          )}

          {place.seasonal && (
            <p className="detail-seasonal">
              <Clock3 size={14} />
              <span>{place.seasonal}</span>
            </p>
          )}

          <div className="detail-actions">
            <a
              className="button button-primary"
              href={directionsHref}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation size={15} />
              Directions
              <span className="button-aside">{modeMeta.label}</span>
            </a>
            <a
              className="button button-secondary"
              href={searchHref}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin size={15} />
              Google Maps
              <ArrowUpRight size={13} className="button-external" />
            </a>
          </div>

          <div className="detail-secondary">
            <button
              type="button"
              className={`detail-toggle ${saved ? 'is-on' : ''}`}
              onClick={onToggleSave}
              aria-pressed={saved}
            >
              <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
              {saved ? 'Saved' : 'Save'}
            </button>
            <button
              type="button"
              className={`detail-toggle ${visited ? 'is-on' : ''}`}
              onClick={onToggleVisited}
              aria-pressed={visited}
            >
              <Check size={14} />
              {visited ? 'Been here' : 'Mark visited'}
            </button>
          </div>

          {(webHref || wikiHref || place.phone) && (
            <div className="detail-links">
              {webHref && (
                <a href={webHref} target="_blank" rel="noreferrer">
                  <Globe2 size={13} />
                  Website
                  <ExternalLink size={11} />
                </a>
              )}
              {wikiHref && (
                <a href={wikiHref} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} />
                  Wikipedia
                </a>
              )}
              {place.phone && (
                <a href={`tel:${place.phone.replace(/\s+/g, '')}`}>
                  <Phone size={13} />
                  {place.phone}
                </a>
              )}
            </div>
          )}

          <footer className="detail-footer">
            {hasImage && place.imgPage && (
              <a
                className="photo-credit"
                href={place.imgPage}
                target="_blank"
                rel="noreferrer"
              >
                Photo: {place.imgCredit || 'Wikimedia Commons'}
                {place.imgLicense ? ` · ${place.imgLicense}` : ''}
              </a>
            )}
            <p className="detail-source">
              {place.curated && !place.synthetic
                ? 'An editorial pick from the atlas.'
                : 'A listing from the OpenStreetMap survey.'}
              {place.osm && (
                <>
                  {' '}
                  <a
                    href={`https://www.openstreetmap.org/${place.osm}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View the map object
                  </a>
                  .
                </>
              )}
            </p>
          </footer>
        </div>
      </aside>
    </>
  );
}
