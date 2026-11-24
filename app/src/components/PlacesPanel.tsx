import { useEffect, useRef } from 'react';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { formatCount } from '../lib/geo';
import type { ResultRow, Theme } from '../lib/types';
import PlaceCard from './PlaceCard';

interface PlacesPanelProps {
  rows: ResultRow[];
  total: number;
  shown: number;
  query: string;
  theme: Theme;
  saved: Set<string>;
  visited: Set<string>;
  selectedId: string | null;
  categoriesActive: boolean;
  canWiden: boolean;
  onQuery: (query: string) => void;
  onSelect: (row: ResultRow) => void;
  onToggleSave: (place: ResultRow['place']) => void;
  onShowMore: () => void;
  onClearCategories: () => void;
  onWiden: () => void;
  onOpenFilters: () => void;
}

export default function PlacesPanel({
  rows,
  total,
  shown,
  query,
  theme,
  saved,
  visited,
  selectedId,
  categoriesActive,
  canWiden,
  onQuery,
  onSelect,
  onToggleSave,
  onShowMore,
  onClearCategories,
  onWiden,
  onOpenFilters,
}: PlacesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasMore = shown < rows.length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '/' && !document.querySelector('[role="dialog"]')) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="places-panel">
      <div className="search-field">
        <Search size={15} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search in reach — name, food, area"
          aria-label="Search places within reach"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query) {
              event.stopPropagation();
              onQuery('');
            }
          }}
        />
        {query ? (
          <button
            type="button"
            className="search-clear"
            onClick={() => onQuery('')}
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        ) : (
          <kbd className="search-kbd">/</kbd>
        )}
        <button
          type="button"
          className="search-filter"
          onClick={onOpenFilters}
          aria-label="Open filters"
          title="Open filters"
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>

      <div className="results-head">
        <div>
          <p className="eyebrow">Within reach</p>
          <strong>
            {formatCount(total)} {total === 1 ? 'place' : 'places'}
          </strong>
        </div>
        <span className="results-hint">picks first</span>
      </div>

      {rows.length === 0 ? (
        <div className="results-empty">
          <p className="eyebrow">Nothing in this window</p>
          <h3>Try a wider net.</h3>
          <p>
            {query
              ? `No place in reach matches “${query}”. Clear the search or try a different window.`
              : 'No places fit this combination yet. Widen the travel window or pick another neighbourhood.'}
          </p>
          <div className="empty-actions">
            {query && (
              <button type="button" className="button button-secondary" onClick={() => onQuery('')}>
                Clear search
              </button>
            )}
            {categoriesActive && (
              <button
                type="button"
                className="button button-secondary"
                onClick={onClearCategories}
              >
                All categories
              </button>
            )}
            {canWiden && (
              <button type="button" className="button button-primary" onClick={onWiden}>
                Widen the window
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <ul className="place-list">
            {rows.map((row) => (
              <PlaceCard
                key={row.place.id}
                row={row}
                theme={theme}
                saved={saved.has(row.place.id)}
                visited={visited.has(row.place.id)}
                selected={selectedId === row.place.id}
                onSelect={() => onSelect(row)}
                onToggleSave={() => onToggleSave(row.place)}
              />
            ))}
          </ul>

          <div className="list-foot">
            {hasMore ? (
              <button type="button" className="show-more" onClick={onShowMore}>
                <ChevronDown size={14} />
                Show {Math.min(48, rows.length - shown)} more
              </button>
            ) : (
              <p className="list-end">
                That’s all {formatCount(rows.length)} in this window.
              </p>
            )}
            <p className="results-fine">
              Times are estimates, not live traffic. Distances are as the crow
              flies.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
