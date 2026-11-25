/**
 * Time-of-day leaning.
 *
 * The atlas already knows how long it takes to get somewhere; this adds a
 * gentle sense of *when* a place is worth going. It reads the hand-written
 * `bestTime` notes first, then falls back to a few obvious category habits
 * (bars after dark, museums in the afternoon, breakfast before eleven).
 *
 * The adjustment is deliberately small: two minutes in the right window, one
 * minute outside it. It is a lean, not a filter, and a place with no readable
 * note is left alone.
 */

import type { Clock } from './hours';
import type { Place } from './types';

interface TimeWindow {
  start: number;
  end: number;
  /** 0 = Monday, matching the atlas clock. Absent means every day. */
  days?: number[];
}

const BEST_TIME_CACHE = new Map<string, TimeWindow[]>();

function clockMinutes(
  hourText: string | undefined,
  minuteText: string | undefined,
  meridiem: string | undefined,
): number | null {
  const hour = Number(hourText);
  const minute = minuteText == null ? 0 : Number(minuteText);
  if (!Number.isFinite(hour) || hour > 24) return null;
  if (!Number.isFinite(minute) || minute > 59) return null;
  if (hour === 24 && minute !== 0) return null;
  let out = hour * 60 + minute;
  if (meridiem === 'pm' && hour < 12) out += 12 * 60;
  if (meridiem === 'am' && hour === 12) out -= 12 * 60;
  return out;
}

function pushWindow(
  windows: TimeWindow[],
  start: number | null,
  end: number | null,
  days?: number[],
): void {
  if (start == null || end == null) return;
  const close = end <= start ? end + 1440 : end;
  windows.push({ start, end: close, days });
}

function inWindow(window: TimeWindow, clock: Clock): boolean {
  if (window.days && !window.days.includes(clock.day)) return false;
  const now = clock.minutes;
  if (now >= window.start && now < window.end) return true;
  // A late window such as 9pm–1am also covers the small hours of the next day.
  return (
    window.end > 1440 && now + 1440 >= window.start && now + 1440 < window.end
  );
}

function parseWindows(raw: string, sunsetMinute: number | null): TimeWindow[] {
  const key = `${raw.trim().toLowerCase()}|${sunsetMinute ?? ''}`;
  const cached = BEST_TIME_CACHE.get(key);
  if (cached) return cached;

  let text = raw
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text || /\bany(?:\s+time)?\b/.test(text)) {
    BEST_TIME_CACHE.set(key, []);
    return [];
  }

  const windows: TimeWindow[] = [];

  // Explicit ranges: "6–9am", "11am–7pm", "5pm–late", "12.30pm–3pm".
  const rangeRe =
    /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|to)\s*(?:(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?|late)/g;
  for (const match of text.matchAll(rangeRe)) {
    const startMeridiem = match[3] || match[6];
    const endMeridiem = match[6] || match[3];
    const start = clockMinutes(match[1], match[2], startMeridiem);
    let end = match[4]
      ? clockMinutes(match[4], match[5], endMeridiem)
      : 23 * 60 + 30;
    if (end == null && !match[4]) end = null;
    // "5–late" is a bar note, so read the bare hour as evening.
    const startValue =
      start != null && !match[3] && !match[6] && start < 12 * 60
        ? start + 12 * 60
        : start;
    pushWindow(windows, startValue, end);
  }
  if (windows.length) {
    // Explicit times are the strongest signal; still let a "sunset" word add
    // a second window below.
    text = text.replace(rangeRe, ' ');
  }

  const afterRe = /\bafter\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/g;
  for (const match of text.matchAll(afterRe)) {
    const start = clockMinutes(match[1], match[2], match[3]);
    pushWindow(windows, start, 1440);
  }
  text = text.replace(afterRe, ' ');

  const consume = (
    pattern: RegExp,
    start: number,
    end: number,
    days?: number[],
  ) => {
    if (!pattern.test(text)) return;
    text = text.replace(pattern, ' ');
    pushWindow(windows, start, end, days);
  };

  // Day-specific phrases first, so "Sunday lunch" does not become every lunch.
  consume(/\bweekend mornings?\b/g, 6 * 60, 12 * 60, [5, 6]);
  consume(/\bsunday lunch\b/g, 12 * 60, 15 * 60, [6]);

  // Specific names before their broader parent phrase.
  consume(/\bearly morning\b/g, 5 * 60, 9 * 60);
  consume(/\blate morning\b/g, 9 * 60, 12 * 60 + 30);
  consume(/\bmorning\b/g, 6 * 60, 11 * 60 + 30);
  consume(/\bbreakfast\b/g, 6 * 60 + 30, 11 * 60);
  consume(/\blate afternoon\b/g, 15 * 60, 18 * 60);
  consume(/\bafternoon\b/g, 12 * 60, 17 * 60 + 30);
  consume(/\blate evening\b/g, 21 * 60, 23 * 60 + 30);
  consume(/\bevenings?\b/g, 17 * 60, 21 * 60 + 30);
  consume(/\bearly dinner\b/g, 18 * 60, 20 * 60 + 30);
  consume(/\bdinner\b/g, 19 * 60, 22 * 60 + 30);
  consume(/\blunch\b/g, 12 * 60, 15 * 60);
  consume(/\bdaytime\b/g, 8 * 60, 18 * 60);
  consume(/\b(?:after dark|night)\b/g, 19 * 60, 24 * 60);

  if (/\b(?:sunset|dusk|golden hour)\b/.test(text)) {
    if (sunsetMinute != null) {
      pushWindow(windows, sunsetMinute - 40, sunsetMinute + 20);
    } else {
      pushWindow(windows, 17 * 60 + 30, 19 * 60);
    }
  }

  BEST_TIME_CACHE.set(key, windows);
  return windows;
}

function fallbackAdjustment(place: Place, clock: Clock): number {
  const hay = `${place.sub} ${(place.tags || []).join(' ')}`.toLowerCase();
  let window: [number, number] | null = null;

  if (/\b(?:pub|bar|brewpub|brewery|cocktail|nightclub)\b/.test(hay)) {
    window = [17 * 60, 24 * 60];
  } else if (/\bbreakfast\b/.test(hay)) {
    window = [6 * 60 + 30, 11 * 60];
  } else if (place.cat === 'culture') {
    if (/\b(?:theatre|cinema|auditorium|amphitheatre)\b/.test(hay)) {
      window = [17 * 60, 22 * 60 + 30];
    } else if (
      /\b(?:museum|gallery|library|art|memorial|monument|palace|fort)\b/.test(
        hay,
      )
    ) {
      window = [12 * 60, 17 * 60 + 30];
    }
  }

  if (!window) return 0;
  return inWindow({ start: window[0], end: window[1] }, clock) ? -1.5 : 0.5;
}

/**
 * How many ranking minutes this place should gain or lose for the current
 * hour. Negative lifts it up the list.
 */
export function timeOfDayAdjustment(
  place: Place,
  clock: Clock,
  sunsetMinute: number | null = null,
): number {
  if (place.bestTime) {
    const windows = parseWindows(place.bestTime, sunsetMinute);
    // "Any" and anything the parser cannot read stay neutral. Falling back to
    // a category habit here would punish a place for a note we simply missed.
    if (!windows.length) return 0;
    const today = windows.filter(
      (window) => !window.days || window.days.includes(clock.day),
    );
    // A Sunday lunch note on a Wednesday should not penalise the place.
    if (!today.length) return 0;
    return today.some((window) => inWindow(window, clock)) ? -2 : 1;
  }
  return fallbackAdjustment(place, clock);
}

/** A short label for the current part of the day, used in the fine print. */
export function timeOfDayLabel(clock: Clock): string {
  const minutes = clock.minutes;
  if (minutes < 5 * 60) return 'late night';
  if (minutes < 11 * 60 + 30) return 'morning';
  if (minutes < 15 * 60) return 'midday';
  if (minutes < 18 * 60) return 'afternoon';
  if (minutes < 21 * 60 + 30) return 'evening';
  return 'late night';
}

/** Parse a trail duration such as "2 hr 15 min" or "7–8 hours". */
export function durationMinutes(value: string): number | null {
  const text = value.toLowerCase();
  let total = 0;
  let found = false;
  const hours = /(\d{1,2})\s*(?:hr|hour)s?/.exec(text);
  if (hours) {
    total += Number(hours[1]) * 60;
    found = true;
  }
  const mins = /(\d{1,3})\s*(?:min|minute)s?/.exec(text);
  if (mins) {
    total += Number(mins[1]);
    found = true;
  }
  if (found) return total || null;

  // Ranges like "7–8 hours" are read at their upper bound.
  const range = /(\d{1,2})\s*[–-]\s*(\d{1,2})\s*hours?/.exec(text);
  if (range) return Number(range[2]) * 60;
  return null;
}
