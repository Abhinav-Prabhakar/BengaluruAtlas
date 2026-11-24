import { useState } from 'react';
import { Bookmark, Check, Shuffle } from 'lucide-react';
import type { ResultRow, Theme } from '../lib/types';
import PlaceCard from './PlaceCard';

interface SavedPanelProps {
  savedRows: ResultRow[];
  visitedRows: ResultRow[];
  selectedId: string | null;
  theme: Theme;
  onSelect: (row: ResultRow) => void;
  onToggleSave: (row: ResultRow) => void;
  onGoPlaces: () => void;
  onSurprise: () => void;
}

type SavedView = 'saved' | 'visited';

export default function SavedPanel({
  savedRows,
  visitedRows,
  selectedId,
  theme,
  onSelect,
  onToggleSave,
  onGoPlaces,
  onSurprise,
}: SavedPanelProps) {
  const [view, setView] = useState<SavedView>('saved');
  const rows = view === 'saved' ? savedRows : visitedRows;
  const empty = savedRows.length === 0 && visitedRows.length === 0;

  if (empty) {
    return (
      <div className="saved-panel">
        <div className="empty-state">
          <span className="empty-icon">
            <Bookmark size={22} strokeWidth={1.6} />
          </span>
          <p className="eyebrow">Your field notes</p>
          <h3>A little list of your own.</h3>
          <p>
            Tap the bookmark on any place to keep it here. Everything stays in
            this browser — no account, no server, no tracking.
          </p>
          <div className="empty-actions">
            <button type="button" className="button button-primary" onClick={onGoPlaces}>
              Browse places
            </button>
            <button type="button" className="button button-secondary" onClick={onSurprise}>
              <Shuffle size={14} />
              Surprise me
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-panel">
      <div className="panel-intro is-tight">
        <p className="eyebrow">Your field notes</p>
        <h3>Kept for later.</h3>
      </div>

      <div className="saved-tabs" role="tablist" aria-label="Saved places">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'saved'}
          className={view === 'saved' ? 'is-active' : ''}
          onClick={() => setView('saved')}
        >
          <Bookmark size={13} />
          Saved <span>{savedRows.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'visited'}
          className={view === 'visited' ? 'is-active' : ''}
          onClick={() => setView('visited')}
        >
          <Check size={13} />
          Been there <span>{visitedRows.length}</span>
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="saved-empty">
          <p>
            {view === 'saved'
              ? 'Nothing saved yet. Use the bookmark on any card or place panel.'
              : 'No places marked visited yet. Open a place and tap “Mark visited”.'}
          </p>
          <button type="button" className="text-button" onClick={onGoPlaces}>
            Back to places
          </button>
        </div>
      ) : (
        <ul className="place-list is-saved">
          {rows.map((row) => (
            <PlaceCard
              key={row.place.id}
              row={row}
              theme={theme}
              saved={savedRows.some((saved) => saved.place.id === row.place.id)}
              visited={visitedRows.some((visited) => visited.place.id === row.place.id)}
              selected={selectedId === row.place.id}
              onSelect={() => onSelect(row)}
              onToggleSave={() => onToggleSave(row)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
