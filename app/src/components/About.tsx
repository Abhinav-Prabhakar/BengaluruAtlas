import { ExternalLink, Github, Heart, MapPinned, Monitor, Moon, Sun } from 'lucide-react';
import type { Atlas, ThemePref } from '../lib/types';
import { formatCount } from '../lib/geo';
import Modal from './Modal';

interface AboutProps {
  atlas: Atlas;
  themePref: ThemePref;
  onThemePref: (pref: ThemePref) => void;
  onClose: () => void;
}

export default function About({ atlas, themePref, onThemePref, onClose }: AboutProps) {
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
        <h3>Appearance</h3>
        <p>
          The atlas starts by matching your device. Set it here if you would
          rather keep one theme regardless of the system setting.
        </p>
        <div className="theme-choice" role="group" aria-label="Theme preference">
          <button
            type="button"
            className={themePref === 'system' ? 'is-on' : ''}
            aria-pressed={themePref === 'system'}
            onClick={() => onThemePref('system')}
          >
            <Monitor size={14} />
            Match device
          </button>
          <button
            type="button"
            className={themePref === 'light' ? 'is-on' : ''}
            aria-pressed={themePref === 'light'}
            onClick={() => onThemePref('light')}
          >
            <Sun size={14} />
            Light
          </button>
          <button
            type="button"
            className={themePref === 'dark' ? 'is-on' : ''}
            aria-pressed={themePref === 'dark'}
            onClick={() => onThemePref('dark')}
          >
            <Moon size={14} />
            Dark
          </button>
        </div>
      </section>

      <section className="about-section">
        <h3>How the travel window works</h3>
        <p>
          The circle starts with typical door-to-door speeds — walking 4.5 km/h,
          cycling 11, auto 17, cab 23 — a 1.28× road factor and a few minutes of
          overhead for waiting and parking. Then it shrinks by the current
          slowdown on the instrumented corridors nearest you.
        </p>
        <p className="about-formula">
          reach ≈ (speed × moving minutes ÷ 1.28) ÷ live slowdown
        </p>
        <p>
          The first cards are routed on real roads through OSRM and multiplied
          by the same live factor; the rest are modelled from distance, mode and
          those corridor speeds. When GitHub is unreachable, the app falls back
          to a baked 24-hour profile. The Directions button hands the last mile
          to Google Maps — treat the atlas as a shortlist, not a promise.
        </p>
      </section>

      <section className="about-section">
        <h3>Live traffic</h3>
        <p>
          Thirteen Bengaluru corridors are sampled every ten minutes by the
          open <a href="https://github.com/thecont1/traffic-monitor-lizard" target="_blank" rel="noreferrer">traffic-monitor-lizard</a>{' '}
          dataset. The atlas reads the newest rows straight from the repository,
          caches them for ten minutes and maps each reading onto the nearest
          places. No key, no account, no server of our own.
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
            <strong>Neighbourhoods and trails.</strong> A hand-written core,
            then {atlas.trails.length} routes assembled from the atlas and
            checked against the map. Trail lines are sketches between stops.
          </li>
          <li>
            <strong>Map and routing.</strong> OpenFreeMap vector tiles, styled
            here in paper and ink. Road times from OSRM on OpenStreetMap.de.
          </li>
          <li>
            <strong>Traffic.</strong> The open traffic-monitor-lizard dataset,
            with a baked hourly profile for when it cannot be reached.
          </li>
        </ul>
      </section>

      <section className="about-section">
        <h3>Photography</h3>
        <p>
          Every place gets a picture. Where an openly licensed photograph
          exists, it is hotlinked from Wikimedia Commons with the licence shown
          on the place. Editorial picks without a photograph of their own use a
          neighbourhood photograph, marked as such. Everything else gets a
          designed cover drawn from its category and name.
        </p>
        <p>
          Google Maps photography is not used: it is copyrighted, cannot be
          hotlinked, and scraping it would break both the terms and the static
          build. The atlas stays free and legally distributable.
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
                  {place.imgScope === 'area' ? 'Neighbourhood photo · ' : ''}
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
          closed, a temple may have changed its hours. Traffic is sampled every
          ten minutes, not guaranteed. Check before you go — nothing here is
          sponsored.
        </p>
        <ul className="about-list">
          <li>
            Place data © OpenStreetMap contributors, ODbL. Map tiles by
            OpenFreeMap. Routing by OSRM / OpenStreetMap.de. Traffic readings
            from traffic-monitor-lizard. Photography under the licences listed
            above.
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
