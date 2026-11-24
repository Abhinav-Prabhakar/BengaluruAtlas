import { Bookmark, Compass, Route } from 'lucide-react';
import type { TabId } from '../lib/types';

interface TabBarProps {
  tab: TabId;
  onTab: (tab: TabId) => void;
  placesCount: number;
  trailsCount: number;
  savedCount: number;
}

export default function TabBar({
  tab,
  onTab,
  placesCount,
  trailsCount,
  savedCount,
}: TabBarProps) {
  const tabs = [
    { id: 'places' as const, label: 'Places', icon: Compass, count: placesCount },
    { id: 'trails' as const, label: 'Trails', icon: Route, count: trailsCount },
    { id: 'saved' as const, label: 'Saved', icon: Bookmark, count: savedCount },
  ];

  return (
    <nav className="tab-bar" aria-label="Views">
      {tabs.map(({ id, label, icon: Icon, count }) => (
        <button
          type="button"
          key={id}
          className={`tab ${tab === id ? 'is-active' : ''}`}
          onClick={() => onTab(id)}
          aria-current={tab === id ? 'page' : undefined}
        >
          <Icon size={14} strokeWidth={1.9} />
          <span>{label}</span>
          <span className="tab-count">
            {count > 9999 ? `${Math.round(count / 1000)}k` : count.toLocaleString('en-IN')}
          </span>
        </button>
      ))}
    </nav>
  );
}
