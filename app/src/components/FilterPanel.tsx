import type { CSSProperties } from 'react';
import { Info } from 'lucide-react';
import {
  CATEGORIES,
  MODES,
  TIME_STOPS,
  type CategoryMeta,
} from '../lib/catalog';
import { formatCount } from '../lib/geo';
import type {
  Area,
  CategoryId,
  Origin,
  Theme,
  TravelMode,
} from '../lib/types';
import OriginPicker from './OriginPicker';

interface FilterPanelProps {
  areas: Area[];
  origin: Origin;
  categories: CategoryId[];
  mode: TravelMode;
  minutes: number;
  radiusKm: number;
  counts: Record<CategoryId, number>;
  totalWithin: number;
  theme: Theme;
  onSelectArea: (area: Area) => void;
  onNearMe: () => void;
  onPickMap: () => void;
  onToggleCategory: (category: CategoryId) => void;
  onClearCategories: () => void;
  onMode: (mode: TravelMode) => void;
  onMinutes: (minutes: number) => void;
}

function compactCount(value: number): string {
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function CategoryChip({
  category,
  count,
  selected,
  onToggle,
  theme,
}: {
  category: CategoryMeta;
  count: number;
  selected: boolean;
  onToggle: () => void;
  theme: Theme;
}) {
  const Icon = category.icon;
  const color = theme === 'dark' ? category.darkColor : category.color;
  const style = { '--cat': color } as CSSProperties;
  return (
    <button
      type="button"
      className={`cat-chip ${selected ? 'is-selected' : ''} ${count === 0 ? 'is-quiet' : ''}`}
      onClick={onToggle}
      aria-pressed={selected}
      style={style}
      title={`${category.full} · ${formatCount(count)} in range`}
    >
      <Icon size={14} strokeWidth={1.9} className="cat-chip-icon" />
      <span className="cat-chip-label">{category.label}</span>
      <span className="cat-chip-count">{compactCount(count)}</span>
    </button>
  );
}

export default function FilterPanel({
  areas,
  origin,
  categories,
  mode,
  minutes,
  radiusKm,
  counts,
  totalWithin,
  theme,
  onSelectArea,
  onNearMe,
  onPickMap,
  onToggleCategory,
  onClearCategories,
  onMode,
  onMinutes,
}: FilterPanelProps) {
  const timeIndex = Math.max(0, TIME_STOPS.indexOf(minutes as (typeof TIME_STOPS)[number]));
  const fillPercent = (timeIndex / (TIME_STOPS.length - 1)) * 100;
  const sliderStyle = { '--fill': `${fillPercent}%` } as CSSProperties;

  return (
    <section className="filters" aria-label="Filters">
      <OriginPicker
        areas={areas}
        origin={origin}
        onSelectArea={onSelectArea}
        onNearMe={onNearMe}
        onPickMap={onPickMap}
      />

      <div className="filter-block">
        <div className="filter-head">
          <span className="field-label">Travel window</span>
          <span className="filter-value">{minutes} min</span>
        </div>

        <div className="mode-select" role="group" aria-label="Travel mode">
          {MODES.map((option) => {
            const Icon = option.icon;
            return (
              <button
                type="button"
                key={option.id}
                className={`mode-button ${mode === option.id ? 'is-active' : ''}`}
                onClick={() => onMode(option.id)}
                aria-pressed={mode === option.id}
                title={option.label}
              >
                <Icon size={15} strokeWidth={1.8} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>

        <input
          type="range"
          className="time-slider"
          min={0}
          max={TIME_STOPS.length - 1}
          step={1}
          value={timeIndex}
          onChange={(event) => onMinutes(TIME_STOPS[Number(event.target.value)])}
          style={sliderStyle}
          aria-label="Maximum travel time"
          aria-valuetext={`${minutes} minutes`}
        />
        <div className="slider-labels" aria-hidden="true">
          <span>5 min</span>
          <span>15</span>
          <span>30</span>
          <span>1 hr</span>
        </div>

        <p className="reach-line">
          <span>
            ≈ {radiusKm < 1 ? `${Math.round(radiusKm * 1000)} m` : `${radiusKm.toFixed(1)} km`}{' '}
            reach · {formatCount(totalWithin)} places
          </span>
          <span
            className="reach-info"
            title="Estimated from straight-line distance and typical speeds. It is not live traffic; Google Maps does the real routing."
          >
            <Info size={12} />
            estimate
          </span>
        </p>
      </div>

      <div className="filter-block">
        <div className="filter-head">
          <span className="field-label">In the mood for</span>
          <button
            type="button"
            className="text-button"
            onClick={onClearCategories}
            disabled={categories.length === 0}
          >
            All
          </button>
        </div>
        <div className="cat-grid">
          {CATEGORIES.map((category) => (
            <CategoryChip
              key={category.id}
              category={category}
              count={counts[category.id] || 0}
              selected={categories.includes(category.id)}
              onToggle={() => onToggleCategory(category.id)}
              theme={theme}
            />
          ))}
        </div>
      </div>

      <div className="filter-note">
        <Info size={15} />
        <p>
          <strong>Reach is an honest estimate.</strong> Straight-line distance, typical
          door-to-door speeds and a 1.28× road factor. Not live traffic — Google Maps
          handles the real route.
        </p>
      </div>
    </section>
  );
}
