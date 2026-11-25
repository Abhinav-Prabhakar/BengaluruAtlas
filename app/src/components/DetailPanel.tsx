import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  CarFront,
  Check,
  Clock3,
  CloudRain,
  ExternalLink,
  Globe2,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Star,
  Sunset,
  X,
  Route,
} from 'lucide-react';
import { CATEGORY_BY_ID, MODE_BY_ID, categoryColor } from '../lib/catalog';
import { formatCoords, formatDistance } from '../lib/geo';
import { formatArrivalClock, formatClockMinutes } from '../lib/hours';
import {
  describePlace,
  googleMapsDirectionsUrl,
  googleMapsSearchUrl,
  placeFacts,
} from '../lib/places';
import type { ArrivalInfo, Place, Theme, TravelMode } from '../lib/types';
import CoverArt, { coverSeed } from './CoverArt';

interface DetailPanelProps {
  place: Place;
  theme: Theme;
  mode: TravelMode;
  originName: string;
  distanceKm: number;
  minutes: number;
  live?: boolean;
  traffic?: 'light' | 'moving' | 'heavy' | 'gridlock';
  kmph?: number;
  freeKmph?: number;
  arrival?: ArrivalInfo | null;
  sunsetMinute?: number | null;
  rainLaterLabel?: string | null;
  rainLaterMinute?: number | null;
  nowMinute?: number;
  onTheWay?: Array<{ place: Place; extraMinutes: number }>;
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
  live,
  traffic,
  kmph,
  freeKmph,
  arrival,
  sunsetMinute,
  rainLaterLabel,
  rainLaterMinute,
  nowMinute,
  onTheWay = [],
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
  const uberHref =
    'https://m.uber.com/ul/?action=setPickup&pickup=my_location' +
    `&dropoff[latitude]=${place.lat}&dropoff[longitude]=${place.lon}` +
    `&dropoff[nickname]=${encodeURIComponent(place.name)}`;

  // A shower after closing time is not a reason to rush. Only mention rain
  // that lands while the place is still open.
  const rainLaterRelevant =
    Boolean(rainLaterLabel) &&
    rainLaterMinute != null &&
    nowMinute != null &&
    rainLaterMinute > nowMinute &&
    arrival?.state !== 'closed' &&
    (arrival?.closesAt == null || rainLaterMinute <= arrival.closesAt) &&
    (place.cat === 'outdoors' ||
      place.tags?.includes('outdoor seating'));

  const sunsetNote =
    place.cat === 'outdoors' &&
    sunsetMinute != null &&
    nowMinute != null &&
    nowMinute <= sunsetMinute + 30 &&
    arrival?.state !== 'closed'
      ? (() => {
          const leaveBy = sunsetMinute - minutes;
          const cushion = sunsetMinute - nowMinute - minutes;
          if (cushion <= 0) {
            return `Sunset is at ${formatClockMinutes(sunsetMinute)} — you'd arrive after it.`;
          }
          if (leaveBy > nowMinute + 2) {
            return `Leave by ${formatClockMinutes(leaveBy)} to catch sunset at ${formatClockMinutes(sunsetMinute)}.`;
          }
          return `You'd reach ${cushion} min before sunset at ${formatClockMinutes(sunsetMinute)}.`;
        })()
      : null;

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
              <CoverArt
                cat={place.cat}
                seed={coverSeed(place.name)}
                className="detail-cover-art"
              />
              <span className="hero-ring hero-ring-a" />
              <span className="hero-ring hero-ring-b" />
              <Icon className="detail-cover-icon" size={22} strokeWidth={1.4} />
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
            <p className={`detail-travel ${live ? 'is-live' : ''}`}>
              <Navigation size={13} />
              <span>
                ≈ {minutes} min {modeMeta.label.toLowerCase()} ·{' '}
                {formatDistance(distanceKm)} from {originName}
              </span>
              {live && <em className="live-pill">road-routed</em>}
            </p>
            {traffic && (
              <p className={`detail-traffic is-${traffic}`}>
                Live traffic: {traffic}
                {kmph
                  ? ` · ${Math.round(kmph)}${
                      freeKmph ? ` of ${Math.round(freeKmph)}` : ''
                    } km/h${freeKmph ? ' free flow' : ' on the nearest corridor'}`
                  : ''}
              </p>
            )}
            {arrival?.state === 'closed' && (
              <p className="detail-hours is-closed">
                <Clock3 size={12} />
                <span>
                  Closed when you arrive
                  {arrival.opensAt != null
                    ? ` · opens ${formatArrivalClock(arrival.opensAt)}`
                    : ''}
                </span>
              </p>
            )}
            {arrival?.state === 'open' && arrival.closingSoon && (
              <p className="detail-hours is-closing">
                <Clock3 size={12} />
                <span>
                  Closes {formatArrivalClock(arrival.closesAt)} — you would arrive
                  around {formatClockMinutes(arrival.arrivalAt)}
                </span>
              </p>
            )}
            {arrival?.state === 'open' &&
              !arrival.closingSoon &&
              arrival.closesAt != null && (
                <p className="detail-hours">
                  <Clock3 size={12} />
                  <span>
                    Open when you arrive · closes{' '}
                    {formatArrivalClock(arrival.closesAt)}
                  </span>
                </p>
              )}
            {sunsetNote && (
              <p className="detail-sunset">
                <Sunset size={12} />
                <span>{sunsetNote}</span>
              </p>
            )}
            {rainLaterRelevant && (
              <p className="detail-rain">
                <CloudRain size={12} />
                <span>
                  Rain likely after {rainLaterLabel} — go earlier if you can.
                </span>
              </p>
            )}
            {onTheWay.length > 0 && (
              <p className="detail-onway">
                <Route size={12} />
                <span>
                  On your way:{' '}
                  {onTheWay
                    .map(({ place: stop, extraMinutes }) => `${stop.name} (+${extraMinutes} min)`)
                    .join(' · ')}
                </span>
              </p>
            )}
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

          <div className="detail-links">
            <a href={uberHref} target="_blank" rel="noreferrer">
              <CarFront size={13} />
              Uber here
              <ExternalLink size={11} />
            </a>
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

          <footer className="detail-footer">
            {hasImage && place.imgPage && (
              <a
                className="photo-credit"
                href={place.imgPage}
                target="_blank"
                rel="noreferrer"
              >
                {place.imgScope === 'area' ? 'Neighbourhood photo' : 'Photo'}:{' '}
                {place.imgCredit || 'Wikimedia Commons'}
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
