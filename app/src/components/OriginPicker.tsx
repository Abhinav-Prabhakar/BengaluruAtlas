import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  Crosshair,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  X,
} from 'lucide-react';
import type { Area, Origin } from '../lib/types';

interface OriginPickerProps {
  areas: Area[];
  origin: Origin;
  onSelectArea: (area: Area) => void;
  onNearMe: () => void;
  onPickMap: () => void;
}

export default function OriginPicker({
  areas,
  origin,
  onSelectArea,
  onNearMe,
  onPickMap,
}: OriginPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<{
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return areas;
    return areas.filter((area) =>
      [area.name, area.blurb, ...area.vibe].join(' ').toLowerCase().includes(needle),
    );
  }, [areas, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const openPopover = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 318), window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const openUp = below < 330 && above > below;
    setPosition({
      left,
      width,
      maxHeight: Math.max(240, Math.min(470, (openUp ? above : below) - 10)),
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 8 }
        : { top: rect.bottom + 8 }),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        close();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const handleResize = () => close();
    document.addEventListener('pointerdown', handlePointer);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  const triggerIcon =
    origin.kind === 'geo' ? (
      <Navigation size={16} />
    ) : origin.kind === 'pin' ? (
      <Crosshair size={16} />
    ) : (
      <MapPin size={16} />
    );

  return (
    <>
      <button
        type="button"
        className={`origin-trigger ${open ? 'is-open' : ''}`}
        onClick={() => (open ? close() : openPopover())}
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="origin-icon">{triggerIcon}</span>
        <span className="origin-copy">
          <span className="field-label">Starting from</span>
          <strong>{origin.name}</strong>
        </span>
        <ChevronDown
          size={17}
          className={`origin-chevron ${open ? 'is-open' : ''}`}
        />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            className="origin-popover"
            ref={popoverRef}
            role="dialog"
            aria-label="Choose a starting point"
            style={{
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              top: position.top,
              bottom: position.bottom,
            }}
          >
            <div className="origin-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a neighbourhood"
                aria-label="Search neighbourhoods"
              />
              {query && (
                <button
                  type="button"
                  className="origin-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="origin-actions">
              <button
                type="button"
                className="origin-action"
                onClick={() => {
                  close();
                  onNearMe();
                }}
              >
                <LocateFixed size={15} />
                Use my location
              </button>
              <button
                type="button"
                className="origin-action"
                onClick={() => {
                  close();
                  onPickMap();
                }}
              >
                <Crosshair size={15} />
                Pick on map
              </button>
            </div>

            <div className="origin-list">
              {filtered.map((area) => {
                const selected = origin.kind === 'area' && origin.areaId === area.id;
                return (
                  <button
                    type="button"
                    key={area.id}
                    className={`origin-option ${selected ? 'is-selected' : ''}`}
                    onClick={() => {
                      close();
                      onSelectArea(area);
                    }}
                  >
                    <span className="origin-option-copy">
                      <strong>{area.name}</strong>
                      <span>{area.vibe.slice(0, 3).join(' · ')}</span>
                    </span>
                    {selected && <Check size={15} />}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="origin-empty">No neighbourhood matches “{query}”.</p>
              )}
            </div>
            <p className="origin-hint">
              {filtered.length} neighbourhood{filtered.length === 1 ? '' : 's'} ·
              the map follows your choice
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}
