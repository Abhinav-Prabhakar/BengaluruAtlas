import type { CSSProperties } from 'react';
import { BookmarkPlus, Check, Link2 } from 'lucide-react';
import { CATEGORY_BY_ID, categoryColor } from '../lib/catalog';
import type { Place, Theme } from '../lib/types';
import Modal from './Modal';

interface SharedListProps {
  places: Place[];
  saved: Set<string>;
  theme: Theme;
  onSaveAll: () => void;
  onClose: () => void;
}

export default function SharedList({
  places,
  saved,
  theme,
  onSaveAll,
  onClose,
}: SharedListProps) {
  const fresh = places.filter((place) => !saved.has(place.id)).length;
  const already = places.length - fresh;

  return (
    <Modal
      eyebrow="A list, carried in the link"
      title="Someone sent you their field notes."
      onClose={onClose}
      className="shared-modal"
      footer={
        <div className="shared-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={onSaveAll}
            disabled={fresh === 0}
          >
            <BookmarkPlus size={14} />
            {fresh === 0
              ? 'All saved already'
              : `Save ${fresh} ${fresh === 1 ? 'place' : 'places'}`}
          </button>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Not now
          </button>
        </div>
      }
    >
      <p className="shared-lead">
        {places.length} {places.length === 1 ? 'place' : 'places'} travelled
        here entirely in the URL.
        {already > 0
          ? ` ${already} ${already === 1 ? 'is' : 'are'} already in your saved list.`
          : ''}{' '}
        Saving copies them into this browser — no account, no server.
      </p>

      <ul className="shared-list">
        {places.map((place) => {
          const meta = CATEGORY_BY_ID[place.cat];
          const Icon = meta.icon;
          const isSaved = saved.has(place.id);
          const style = {
            '--cat': categoryColor(place.cat, theme),
          } as CSSProperties;
          return (
            <li key={place.id} className={isSaved ? 'is-saved' : undefined}>
              <span className="shared-cat" style={style} aria-hidden="true">
                <Icon size={13} strokeWidth={1.9} />
              </span>
              <span className="shared-body">
                <strong>{place.name}</strong>
                <span>
                  {place.sub} · {place.area}
                </span>
              </span>
              {isSaved && (
                <span className="shared-saved">
                  <Check size={12} />
                  saved
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="shared-fine">
        <Link2 size={12} />
        The whole list stays in the address bar. Pass the same link on and it
        works without an account.
      </p>
    </Modal>
  );
}
