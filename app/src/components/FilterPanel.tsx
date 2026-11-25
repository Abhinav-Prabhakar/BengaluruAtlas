import { useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronUp, Info, Wind } from 'lucide-react';
import { MODES, TIME_STOPS, type CategoryMeta } from '../lib/catalog';
import { formatCount } from '../lib/geo';
import {
  corridorFactor,
  corridorKmph,
  corridorTone,
  trafficHeadline,
  trafficMoment,
  type TrafficState,
} from '../lib/traffic';
import {
  FEATURED_MOODS,
  MOODS,
  MOOD_BY_ID,
  MOOD_GROUPS,
  moodColor,
} from '../lib/moods';
import type { Area, Origin, Theme, TravelMode } from '../lib/types';
import OriginPicker from './OriginPicker';

interface FilterPanelProps {
  areas: Area[];
  origin: Origin;
  moods: string[];
  mode: TravelMode;
  minutes: number;
  radiusKm: number;
  moodCounts: Record<string, number>;
  totalWithin: number;
  theme: Theme;
  traffic: TrafficState | null;
  onSelectArea: (area: Area) => void;
  onNearMe: () => void;
  onPickMap: () => void;
  onToggleMood: (mood: string) => void;
  onClearMoods: () => void;
  onMode: (mode: TravelMode) => void;
  onMinutes: (minutes: number) => void;
}

function compactCount(value: number): string {
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function MoodTile({
  moodId,
  count,
  selected,
  theme,
  onToggle,
}: {
  moodId: string;
  count: number;
  selected: boolean;
  theme: Theme;
  onToggle: () => void;
}) {
  const mood = MOOD_BY_ID[moodId];
  if (!mood) return null;
  const Icon = mood.icon;
  const style = { '--mood': moodColor(mood, theme) } as CSSProperties;
  const quiet = count === 0;
  return (
    <button
      type="button"
      className={`mood-tile ${selected ? 'is-selected' : ''} ${quiet ? 'is-quiet' : ''}`}
      onClick={onToggle}
      aria-pressed={selected}
      style={style}
      title={`${mood.hint} · ${formatCount(count)} in range`}
    >
      <span className="mood-tile-icon">
        <Icon size={17} strokeWidth={1.7} />
      </span>
      <span className="mood-tile-text">
        <span className="mood-tile-name">{mood.label}</span>
        <span className="mood-tile-count">{compactCount(count)}</span>
      </span>
    </button>
  );
}

function TrafficCard({ state }: { state: TrafficState | null }) {
  if (!state?.model) {
    return (
      <div className="traffic-card is-quiet">
        <Wind size={15} />
        <span>Typical travel times · live readings unavailable</span>
      </div>
    );
  }
  const corridors = state.model.corridors;
  const factors = corridors.map((corridor) => corridorFactor(corridor, state));
  const speeds = corridors.map((corridor) => corridorKmph(corridor, state));
  const slowestIndex = speeds.indexOf(Math.min(...speeds));
  const slowest = corridors[slowestIndex];

  return (
    <div className="traffic-card">
      <div className="traffic-head">
        <span className="traffic-live">
          {state.isLive ? 'Live traffic' : 'Typical traffic'}
        </span>
        <span className="traffic-moment">{trafficMoment(state)}</span>
      </div>
      <p className="traffic-line">{trafficHeadline(state)}</p>
      <div className="traffic-bars" aria-hidden="true">
        {corridors.map((corridor, index) => {
          const factor = factors[index];
          return (
            <span
              key={corridor.id}
              className="traffic-bar"
              style={{
                height: `${Math.max(18, Math.min(100, 28 + (factor - 1) * 62))}%`,
                background: corridorTone(factor),
              }}
              title={`${corridor.name} · ${Math.round(corridor.freeKmph / factor)} km/h`}
            />
          );
        })}
      </div>
      <p className="traffic-foot">
        <span>
          {slowest.name} is slowest · {Math.round(speeds[slowestIndex])} km/h
        </span>
      </p>
    </div>
  );
}

export default function FilterPanel({
  areas,
  origin,
  moods,
  mode,
  minutes,
  radiusKm,
  moodCounts,
  totalWithin,
  theme,
  traffic,
  onSelectArea,
  onNearMe,
  onPickMap,
  onToggleMood,
  onClearMoods,
  onMode,
  onMinutes,
}: FilterPanelProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const timeIndex = Math.max(0, TIME_STOPS.indexOf(minutes as (typeof TIME_STOPS)[number]));
  const fillPercent = (timeIndex / (TIME_STOPS.length - 1)) * 100;
  const trackStyle = { '--fill': `${fillPercent}%` } as CSSProperties;
  const featured = FEATURED_MOODS.map((id) => MOOD_BY_ID[id]).filter(Boolean);
  const extra = MOODS.filter((mood) => !FEATURED_MOODS.includes(mood.id));

  return (
    <section className="filters" aria-label="Filters">
      <OriginPicker
        areas={areas}
        origin={origin}
        onSelectArea={onSelectArea}
        onNearMe={onNearMe}
        onPickMap={onPickMap}
      />

      <div className="filter-block time-block">
        <div className="filter-head">
          <span className="field-label">How far will you go?</span>
          <span className="filter-value">{minutes} min</span>
        </div>

        <div className="mode-switch" role="group" aria-label="Travel mode">
          {MODES.map((option) => {
            const Icon = option.icon;
            return (
              <button
                type="button"
                key={option.id}
                className={`mode-key ${mode === option.id ? 'is-active' : ''}`}
                onClick={() => onMode(option.id)}
                aria-pressed={mode === option.id}
                title={option.label}
              >
                <Icon size={17} strokeWidth={1.7} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>

        <div className="time-rail" style={trackStyle}>
          <span className="time-fill" aria-hidden="true" />
          {TIME_STOPS.map((stop, index) => (
            <button
              type="button"
              key={stop}
              className={`time-dot ${index <= timeIndex ? 'is-filled' : ''} ${
                stop === minutes ? 'is-active' : ''
              }`}
              style={{ left: `${(index / (TIME_STOPS.length - 1)) * 100}%` }}
              onClick={() => onMinutes(stop)}
              aria-pressed={stop === minutes}
              aria-label={`${stop} minutes`}
            >
              <i />
              <b>{stop === 60 ? '1 hr' : stop}</b>
            </button>
          ))}
        </div>

        <p className="reach-line">
          <span>
            ≈ {radiusKm < 1 ? `${Math.round(radiusKm * 1000)} m` : `${radiusKm.toFixed(1)} km`}{' '}
            reach · {formatCount(totalWithin)} places
          </span>
          <span className="reach-info" title="Road distance adjusted for the live speed on nearby corridors.">
            <Info size={12} />
            traffic-adjusted
          </span>
        </p>
      </div>

      <TrafficCard state={traffic} />

      <div className="filter-block mood-block">
        <div className="filter-head">
          <span className="field-label">In the mood for</span>
          <button
            type="button"
            className="text-button"
            onClick={onClearMoods}
            disabled={moods.length === 0}
          >
            All
          </button>
        </div>

        <div className="mood-grid">
          {featured.map((mood) => (
            <MoodTile
              key={mood.id}
              moodId={mood.id}
              count={moodCounts[mood.id] || 0}
              selected={moods.includes(mood.id)}
              theme={theme}
              onToggle={() => onToggleMood(mood.id)}
            />
          ))}
        </div>

        <button
          type="button"
          className={`mood-more ${moreOpen ? 'is-open' : ''}`}
          onClick={() => setMoreOpen((value) => !value)}
          aria-expanded={moreOpen}
        >
          {moreOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {moreOpen ? 'Fewer moods' : `${extra.length} more moods`}
        </button>

        {moreOpen && (
          <div className="mood-groups">
            {MOOD_GROUPS.map((group) => {
              const items = extra.filter((mood) => mood.group === group.id);
              if (!items.length) return null;
              return (
                <div className="mood-group" key={group.id}>
                  <p className="mood-group-label">
                    {group.label}
                    <span>{group.blurb}</span>
                  </p>
                  <div className="mood-cloud">
                    {items.map((mood) => {
                      const Icon = mood.icon;
                      const style = { '--mood': moodColor(mood, theme) } as CSSProperties;
                      const selected = moods.includes(mood.id);
                      return (
                        <button
                          type="button"
                          key={mood.id}
                          className={`mood-pill ${selected ? 'is-selected' : ''}`}
                          style={style}
                          onClick={() => onToggleMood(mood.id)}
                          aria-pressed={selected}
                          title={mood.hint}
                        >
                          <Icon size={12} strokeWidth={1.9} />
                          {mood.label}
                          <em>{compactCount(moodCounts[mood.id] || 0)}</em>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="filter-note">
        <Info size={15} />
        <p>
          <strong>Real roads, real jams.</strong> The first cards use routed road
          times; the rest are modelled from the same live corridor speeds. Tap a
          place for Google Maps before you set off.
        </p>
      </div>
    </section>
  );
}
