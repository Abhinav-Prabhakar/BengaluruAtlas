import { useEffect, useLayoutEffect, useRef } from 'react';
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
  moodsActive: boolean;
  liveTimes: boolean;
  rainy: boolean;
  golden: boolean;
  canWiden: boolean;
  onQuery: (query: string) => void;
  onSelect: (row: ResultRow) => void;
  onToggleSave: (place: ResultRow['place']) => void;
  onShowMore: () => void;
  onClearMoods: () => void;
  onWiden: () => void;
  onOpenFilters: () => void;
}

/**
 * Keep the list calm when travel times arrive and the order changes. Cards
 * glide from their old slot to the new one instead of jumping. A filter that
 * swaps most of the list is left alone; a reorder that keeps most cards in
 * play is eased, so a route correction never looks like a flicker.
 */
function useReorderMotion() {
  const listRef = useRef<HTMLUListElement>(null);
  const positions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-place-id]'));
    const next = new Map<string, number>();
    for (const card of cards) {
      const id = card.dataset.placeId;
      if (id) next.set(id, card.offsetTop);
    }

    const previous = positions.current;
    const overlap = [...next.keys()].filter((id) => previous.has(id)).length;
    const familiar =
      previous.size > 0 && overlap / Math.max(previous.size, next.size) >= 0.5;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (familiar && !reduce) {
      for (const card of cards) {
        const id = card.dataset.placeId;
        if (!id) continue;
        const before = previous.get(id);
        const after = next.get(id);
        if (before == null || after == null) continue;
        const delta = before - after;
        if (Math.abs(delta) < 2) continue;
        card.animate(
          [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
          { duration: 360, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
        );
      }
    }

    positions.current = next;
  });

  return listRef;
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
  moodsActive,
  liveTimes,
  rainy,
  golden,
  canWiden,
  onQuery,
  onSelect,
  onToggleSave,
  onShowMore,
  onClearMoods,
  onWiden,
  onOpenFilters,
}: PlacesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useReorderMotion();
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
        <span className="results-hint">time-aware</span>
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
            {moodsActive && (
              <button
                type="button"
                className="button button-secondary"
                onClick={onClearMoods}
              >
                All moods
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
          <ul className="place-list" ref={listRef}>
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
              {liveTimes
                ? 'Where a road route was available, times are cut by live corridor speeds; the rest are modelled.'
                : 'Times are modelled from distance, mode and live corridor speeds.'}{' '}
              Order is travel time, with editor picks and the hour given a small head start.
              {golden && ' Golden-hour light is lifting outdoor picks.'}
              {rainy && ' Outdoor picks sit lower while rain is likely.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
