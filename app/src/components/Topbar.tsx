import { Info, Moon, Share2, Shuffle, Sun } from 'lucide-react';
import type { Theme, ThemePref } from '../lib/types';
import { AtlasMark } from './Brand';
import WeatherChip from './WeatherChip';

interface TopbarProps {
  theme: Theme;
  themePref: ThemePref;
  onTheme: () => void;
  onShare: () => void;
  onAbout: () => void;
  onSurprise: () => void;
  onHome: () => void;
}

export default function Topbar({
  theme,
  themePref,
  onTheme,
  onShare,
  onAbout,
  onSurprise,
  onHome,
}: TopbarProps) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="brand"
        onClick={onHome}
        aria-label="Bengaluru Atlas — reset the view"
      >
        <AtlasMark className="brand-mark" />
        <span className="brand-text">
          <span className="brand-name">Bengaluru Atlas</span>
          <span className="brand-sub">A field guide to the city</span>
        </span>
      </button>

      <div className="topbar-center">
        <WeatherChip />
      </div>

      <div className="topbar-actions">
        <button type="button" className="topbar-surprise" onClick={onSurprise}>
          <Shuffle size={15} strokeWidth={1.9} />
          <span>Surprise me</span>
        </button>
        <span className="topbar-divider" />
        <button
          type="button"
          className="icon-button"
          onClick={onTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode${
            themePref === 'system' ? ' (currently matching your device)' : ''
          }`}
          title={`Theme: ${
            themePref === 'system' ? 'matching your device' : theme
          } · switch to ${theme === 'dark' ? 'light' : 'dark'}`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onShare}
          aria-label="Copy a link to this view"
          title="Copy a link to this view"
        >
          <Share2 size={17} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onAbout}
          aria-label="About the atlas, data and credits"
          title="About, data and credits"
        >
          <Info size={17} />
        </button>
      </div>
    </header>
  );
}
