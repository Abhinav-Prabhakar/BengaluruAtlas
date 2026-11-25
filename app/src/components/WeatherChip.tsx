import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Sun,
  Sunset,
} from 'lucide-react';
import { formatClock, loadWeather } from '../lib/weather';
import type { WeatherNow } from '../lib/types';

function WeatherIcon({ code }: { code: number }) {
  if (code === 0 || code === 1) return <Sun size={15} strokeWidth={1.8} />;
  if (code === 2) return <CloudSun size={15} strokeWidth={1.8} />;
  if (code === 3) return <Cloud size={15} strokeWidth={1.8} />;
  if (code === 45 || code === 48) return <CloudFog size={15} strokeWidth={1.8} />;
  if (code >= 95) return <CloudLightning size={15} strokeWidth={1.8} />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return <CloudRain size={15} strokeWidth={1.8} />;
  }
  return <CloudSun size={15} strokeWidth={1.8} />;
}

export default function WeatherChip() {
  const [weather, setWeather] = useState<WeatherNow | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      loadWeather().then((value) => {
        if (alive) setWeather(value);
      });
    };
    load();
    // Slightly longer than the cache lifetime, so each tick makes a real request.
    const timer = window.setInterval(load, 11 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!weather) {
    return (
      <div
        className="weather-chip weather-placeholder"
        aria-label="Bengaluru weather is unavailable"
        title="Live weather from Open-Meteo is unavailable right now"
      >
        <span className="weather-place">Bengaluru</span>
        <span className="weather-sep" />
        <span className="weather-coords">Weather unavailable</span>
      </div>
    );
  }

  const detail =
    weather.rainChance >= 35
      ? `Rain ${weather.rainChance}%`
      : `Sunset ${formatClock(weather.sunset)}`;

  return (
    <div
      className={`weather-chip ${weather.golden ? 'is-golden' : ''}`}
      title={`Live from Open-Meteo: ${weather.label}, ${weather.temp}°C in Bengaluru · ${weather.rainChance}% chance of rain in the next few hours`}
      aria-label={`Live weather in Bengaluru: ${weather.label}, ${weather.temp} degrees, ${weather.rainChance} percent chance of rain`}
    >
      {weather.golden ? (
        <Sunset size={15} strokeWidth={1.8} />
      ) : (
        <WeatherIcon code={weather.code} />
      )}
      <strong>{weather.temp}°</strong>
      <span className="weather-label">
        {weather.golden ? 'Golden hour' : weather.label}
      </span>
      <span className="weather-sep" />
      <span className="weather-detail">{detail}</span>
    </div>
  );
}
