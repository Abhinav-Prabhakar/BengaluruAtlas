import type { WeatherNow } from './types';

const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=77.5946' +
  '&current=temperature_2m,precipitation,weather_code' +
  '&hourly=precipitation_probability' +
  '&daily=sunset&timezone=Asia%2FKolkata&forecast_days=1';

const CACHE_KEY = 'bengaluru-atlas:weather:v1';
const MAX_AGE_MS = 10 * 60 * 1000;

interface CachedWeather {
  at: number;
  data: WeatherNow;
}

function readCache(): WeatherNow | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeather;
    if (!parsed?.data || Date.now() - parsed.at > MAX_AGE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: WeatherNow): void {
  try {
    window.sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: Date.now(), data } satisfies CachedWeather),
    );
  } catch {
    /* ignore */
  }
}

function istParts(): {
  isoHour: string;
  minutes: number;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date())
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour || 0);
  const minute = Number(parts.minute || 0);
  return {
    isoHour: `${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2, '0')}:00`,
    minutes: hour * 60 + minute,
  };
}

function wmoLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Bengaluru weather';
}

function minutesFromClock(value: string): number {
  const match = /T(\d{2}):(\d{2})/.exec(value);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatClock(value: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? 'pm' : 'am';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

/** Sunset as minutes since midnight in Bengaluru, or null if unavailable. */
export function sunsetMinute(weather: WeatherNow): number | null {
  const minutes = minutesFromClock(weather.sunset);
  return minutes > 0 ? minutes : null;
}

let pending: Promise<WeatherNow | null> | null = null;

export function isRainCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}

export async function loadWeather(): Promise<WeatherNow | null> {
  if (pending) return pending;
  pending = fetchWeather().finally(() => {
    pending = null;
  });
  return pending;
}

async function fetchWeather(): Promise<WeatherNow | null> {
  const cached = readCache();
  if (cached) return cached;

  try {
    const response = await fetch(WEATHER_URL);
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
      hourly?: { time?: string[]; precipitation_probability?: (number | null)[] };
      daily?: { sunset?: string[] };
    };
    const current = payload.current;
    if (!current || typeof current.temperature_2m !== 'number') return null;

    const { isoHour, minutes } = istParts();
    const hourly = payload.hourly;
    const times = hourly?.time || [];
    const probabilities = hourly?.precipitation_probability || [];
    let index = times.findIndex((time) => time >= isoHour);
    if (index < 0) index = 0;
    const rainChance = Math.max(
      0,
      ...probabilities
        .slice(index, index + 4)
        .map((probability) => (typeof probability === 'number' ? probability : 0)),
    );

    const sunsetRaw = payload.daily?.sunset?.[0] || '';
    const sunsetMinutes = sunsetRaw ? minutesFromClock(sunsetRaw) : 0;
    const golden =
      sunsetMinutes > 0 && minutes >= sunsetMinutes - 50 && minutes <= sunsetMinutes;

    const weather: WeatherNow = {
      temp: Math.round(current.temperature_2m),
      code: current.weather_code ?? 0,
      rainChance: Math.round(rainChance),
      sunset: sunsetRaw,
      golden,
      label: wmoLabel(current.weather_code ?? 0),
    };
    writeCache(weather);
    return weather;
  } catch {
    return null;
  }
}
