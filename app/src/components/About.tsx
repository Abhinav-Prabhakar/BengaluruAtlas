import { ExternalLink, Github, Heart, MapPinned } from 'lucide-react';
import type { Atlas } from '../lib/types';
import { formatCount } from '../lib/geo';
import Modal from './Modal';

interface AboutProps {
  atlas: Atlas;
  onClose: () => void;
}

export default function About({ atlas, onClose }: AboutProps) {
  const photos = atlas.places
    .filter((place) => place.img && place.imgPage)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Modal
      eyebrow="About the atlas"
      title="A field guide, not a directory."
      onClose={onClose}
      className="about-modal"
    >
      <p className="about-lead">
        Bengaluru Atlas is a small, static field guide to the city. Pick a
        starting point, say how far you will go, and the map narrows to what is
        actually within reach — tiffin rooms, lakes, temples, bookshops and the
        odd hidden corner.
      </p>

      <div className="about-stats">
        <div>
          <strong>{formatCount(atlas.meta.total)}</strong>
          <span>places mapped</span>
        </div>
        <div>
          <strong>{atlas.meta.curated}</strong>
          <span>editorial picks</span>
        </div>
        <div>
          <strong>{atlas.areas.length}</strong>
          <span>neighbourhoods</span>
        </div>
        <div>
          <strong>{atlas.trails.length}</strong>
          <span>walks & day trips</span>
        </div>
      </div>

      <section className="about-section">
        <h3>How the travel window works</h3>
        <p>
          The circle is a straight-line estimate, deliberately conservative. We
          take typical door-to-door speeds — walking 4.5 km/h, cycling 11, auto
          17, cab 23 — add a 1.28× road factor and a few minutes of overhead for
          waiting and parking. Traffic, one-ways and the city’s own moods are not
          in the maths.
        </p>
        <p className="about-formula">
          minutes ≈ distance × 1.28 ÷ speed + overhead
        </p>
        <p>
          The Directions button hands the last mile to Google Maps, which knows
          the road, the signals and the traffic. Treat the atlas as a shortlist,
          not a promise.
        </p>
      </section>

      <section className="about-section">
        <h3>Where the listings come from</h3>
        <ul className="about-list">
          <li>
            <strong>Places.</strong> OpenStreetMap contributors, queried and
            tidied for this atlas, under the Open Database Licence (ODbL).
            Generic chain outlets were dropped; the useful, the old and the
            curious were kept.
          </li>
          <li>
            <strong>Editorial picks.</strong> {atlas.meta.curated} places with
            short notes, a best time and a reason to go. The notes are the
            subjective part; the coordinates are not.
          </li>
          <li>
            <strong>Neighbourhoods and trails.</strong> Hand-written, then
            checked against the map. Trail lines are sketches between stops.
          </li>
          <li>
            <strong>Map.</strong> OpenFreeMap vector tiles, styled here in paper
            and ink.
          </li>
        </ul>
      </section>

      <section className="about-section">
        <h3>Photography</h3>
        <p>
          Photographs are hotlinked from Wikimedia Commons under the licence
          shown on each place. Every photo keeps a visible credit link, and the
          full list is below.
        </p>
        <details className="photo-details">
          <summary>Photography credits ({photos.length})</summary>
          <ul>
            {photos.map((place) => (
              <li key={place.id}>
                <a href={place.imgPage || '#'} target="_blank" rel="noreferrer">
                  {place.name}
                </a>
                <span>
                  {' — '}
                  {place.imgCredit || 'Wikimedia Commons'}
                  {place.imgLicense ? ` · ${place.imgLicense}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="about-section">
        <h3>Small print</h3>
        <p>
          OpenStreetMap is wonderful and imperfect: a restaurant may have
          closed, a temple may have changed its hours. Check before you go.
          Nothing here is live data, and nothing is sponsored.
        </p>
        <ul className="about-list">
          <li>
            Place data © OpenStreetMap contributors, ODbL. Map tiles by
            OpenFreeMap. Photography under the licences listed above.
          </li>
          <li>
            Typefaces: Fraunces, Manrope and JetBrains Mono, under the SIL Open
            Font Licence.
          </li>
          <li>
            Your saved places and visited marks live in this browser’s local
            storage. There is no account and no analytics.
          </li>
        </ul>
      </section>

      <footer className="about-footer">
        <p>
          <MapPinned size={14} />
          Made in Bengaluru, for wandering it.
        </p>
        <p>
          <Heart size={13} />
          Built by Abhinav Prabhakar.
        </p>
        <a
          href="https://github.com/Abhinav-Prabhakar/BengaluruAtlas"
          target="_blank"
          rel="noreferrer"
        >
          <Github size={14} />
          Source on GitHub
          <ExternalLink size={11} />
        </a>
      </footer>
    </Modal>
  );
}
