/**
 * Opening hours, read just carefully enough to keep the atlas honest.
 *
 * The data comes from OSM and hand edits, so formats vary. This parser is
 * deliberately conservative: anything it cannot read confidently becomes
 * "unknown" and never moves a place down the list. The only thing that costs a
 * place is a schedule we understand and an arrival time outside it.
 */

import type { ArrivalInfo } from './types';

export interface Clock {
  /** 0 = Monday, matching the order used in the schedules below. */
  day: number;
  /** Minutes since midnight in Bengaluru. */
  minutes: number;
}

interface Interval {
  start: number;
  /** May exceed 1440 when the interval crosses midnight. */
  end: number;
}

export interface HoursSchedule {
  days: Interval[][];
}

const DAY_INDEX: Record<string, number> = {
  mo: 0,
  tu: 1,
  we: 2,
  th: 3,
  fr: 4,
  sa: 5,
  su: 6,
};

const WEEKDAY_SHORT: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

const DAY_WORDS: Array<[RegExp, string]> = [
  [/\bmondays?\b/g, 'mo'],
  [/\btuesdays?\b/g, 'tu'],
  [/\btues\b/g, 'tu'],
  [/\bwednesdays?\b/g, 'we'],
  [/\bweds\b/g, 'we'],
  [/\bthursdays?\b/g, 'th'],
  [/\bthurs\b/g, 'th'],
  [/\bfridays?\b/g, 'fr'],
  [/\bsaturdays?\b/g, 'sa'],
  [/\bsundays?\b/g, 'su'],
  [/\bmon\b/g, 'mo'],
  [/\btue\b/g, 'tu'],
  [/\bwed\b/g, 'we'],
  [/\bthu\b/g, 'th'],
  [/\bfri\b/g, 'fr'],
  [/\bsat\b/g, 'sa'],
  [/\bsun\b/g, 'su'],
  [/\bmo\b/g, 'mo'],
  [/\btu\b/g, 'tu'],
  [/\bwe\b/g, 'we'],
  [/\bth\b/g, 'th'],
  [/\bfr\b/g, 'fr'],
  [/\bsa\b/g, 'sa'],
  [/\bsu\b/g, 'su'],
];

const TIME_RE =
  /(\d{1,3})(?:[:.](\d{1,2}))?\s*(am|pm)?\s*(?:-|to|t0)\s*(\d{1,3})(?:[:.](\d{1,2}))?\s*(am|pm)?/g;

const cache = new Map<string, HoursSchedule | null>();

export function istClock(date = new Date()): Clock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const day = WEEKDAY_SHORT[parts.weekday] ?? 0;
  const hour = Number(parts.hour || 0) % 24;
  const minute = Number(parts.minute || 0);
  return { day, minutes: hour * 60 + minute };
}

function normalize(raw: string): string {
  let text = raw.toLowerCase();
  text = text.replace(/[–—−]/g, '-');
  text = text.replace(/\b12\s+noon\b/g, '12:00');
  text = text.replace(/\bnoon\b/g, '12:00');
  text = text.replace(/\bmidnight\b/g, '00:00');
  for (const [pattern, replacement] of DAY_WORDS) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/\s*-\s*/g, '-');
  return text.replace(/\s+/g, ' ').trim();
}

function minuteValue(
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

/** Read "Mo-Fr", "Sa,Su" or a comma separated list from the start. */
function readDaySpec(text: string): { days: number[] | null; rest: string } {
  let rest = text.replace(/^(?:ph\s*,?\s*)+/, '');
  const days = new Set<number>();
  let found = false;

  for (;;) {
    const match = /^(mo|tu|we|th|fr|sa|su)\b(?:-(mo|tu|we|th|fr|sa|su)\b)?/.exec(rest);
    if (!match) break;
    found = true;
    const start = DAY_INDEX[match[1]];
    const end = match[2] ? DAY_INDEX[match[2]] : start;
    if (match[2]) {
      let day = start;
      for (let step = 0; step < 7; step += 1) {
        days.add(day);
        if (day === end) break;
        day = (day + 1) % 7;
      }
    } else {
      days.add(start);
    }
    rest = rest.slice(match[0].length).replace(/^[\s,-]+/, '');
    if (!/^(mo|tu|we|th|fr|sa|su)\b/.test(rest)) break;
  }

  rest = rest.replace(/^,?\s*ph\b\s*,?\s*/, '').trim();
  return { days: found ? [...days] : null, rest };
}

function parseTimeIntervals(rest: string): Interval[] | null {
  const matches = [...rest.matchAll(TIME_RE)];
  if (!matches.length) return null;

  // If any digits survive the time pattern, the line is not a clean set of
  // intervals. Treat it as unknown rather than risk calling a place closed.
  if (/\d/.test(rest.replace(TIME_RE, ' '))) return null;

  const intervals: Interval[] = [];
  for (const match of matches) {
    const [, sh, sm, sMer, eh, em, eMer] = match;
    const start = minuteValue(sh, sm, sMer);
    const end = minuteValue(eh, em, eMer);
    if (start == null || end == null) return null;
    if (start >= 1440) return null;
    let close = end;
    if (close <= start) close += 1440;
    if (close - start > 24 * 60) return null;
    intervals.push({ start, end: close });
  }
  return intervals.length ? intervals : null;
}

/**
 * Parse a schedule, or return null when the string is not clear enough to use.
 * The cache is keyed by the raw string, which repeats a lot across the atlas.
 */
export function parseHours(raw: string | null | undefined): HoursSchedule | null {
  if (!raw) return null;
  const key = raw.trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const text = normalize(key);
  if (/^(?:open\s+)?24\s*(?:\/\s*7|hours)\b/.test(text)) {
    const all: HoursSchedule = {
      days: Array.from({ length: 7 }, () => [{ start: 0, end: 1440 }]),
    };
    cache.set(key, all);
    return all;
  }

  const days: Interval[][] = Array.from({ length: 7 }, () => []);
  let understood = false;

  for (const rawPart of text.split(';')) {
    const part = rawPart.trim();
    if (!part) continue;
    const { days: selected, rest } = readDaySpec(part);

    if (/\boff\b/.test(rest)) {
      // Qualified closures ("Tu[2,4] off") and public holidays are not
      // predictable enough to apply to every occurrence.
      if (selected && !/\[|\bph\b/.test(part)) {
        for (const day of selected) days[day] = [];
        understood = true;
      }
      continue;
    }

    if (!/\d/.test(rest)) continue;

    // A second day prefix inside a comma-separated clause means the shorthand
    // is more than this parser can safely attribute.
    if (/(?:^|[\s,])(?:mo|tu|we|th|fr|sa|su)\b(?:-(?:mo|tu|we|th|fr|sa|su)\b)?/.test(rest)) {
      cache.set(key, null);
      return null;
    }

    const intervals = parseTimeIntervals(rest);
    if (!intervals) {
      cache.set(key, null);
      return null;
    }
    understood = true;
    const target = selected ?? [0, 1, 2, 3, 4, 5, 6];
    for (const day of target) {
      days[day] = [...days[day], ...intervals];
    }
  }

  const schedule = understood ? { days } : null;
  cache.set(key, schedule);
  return schedule;
}

function formatClock(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 || 12;
  return `${display}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** A clock time relative to the arrival day; may spill into tomorrow. */
export function formatArrivalClock(minutes: number | null): string {
  if (minutes == null) return '';
  const offset = Math.floor(minutes / 1440);
  const clock = formatClock(minutes);
  if (offset === 0) return clock;
  if (offset === 1) return `tomorrow ${clock}`;
  return `in ${offset} days, ${clock}`;
}

export function formatClockMinutes(minutes: number | null): string {
  return minutes == null ? '' : formatClock(minutes);
}

export function arrivalAt(
  schedule: HoursSchedule | null,
  clock: Clock,
): ArrivalInfo {
  if (!schedule) {
    return {
      state: 'unknown',
      closesIn: null,
      closesAt: null,
      opensAt: null,
      closingSoon: false,
      arrivalAt: clock.minutes,
    };
  }

  const now = clock.minutes;
  const today = schedule.days[clock.day] ?? [];
  const yesterday = schedule.days[(clock.day + 6) % 7] ?? [];
  let closesAt: number | null = null;
  let alwaysOpen = false;

  for (const interval of today) {
    if (interval.start <= now && now < Math.min(interval.end, 1440)) {
      if (interval.start === 0 && interval.end === 1440) alwaysOpen = true;
      closesAt = closesAt == null ? interval.end : Math.max(closesAt, interval.end);
    }
  }
  for (const interval of yesterday) {
    if (interval.end > 1440 && now + 1440 < interval.end) {
      const close = interval.end - 1440;
      closesAt = closesAt == null ? close : Math.max(closesAt, close);
    }
  }

  if (closesAt != null) {
    const closesIn = closesAt - now;
    return {
      state: 'open',
      closesIn: alwaysOpen ? null : closesIn,
      closesAt: alwaysOpen ? null : closesAt,
      opensAt: null,
      closingSoon: !alwaysOpen && closesIn <= 20,
      arrivalAt: now,
    };
  }

  let opensAt: number | null = null;
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = schedule.days[(clock.day + offset) % 7] ?? [];
    for (const interval of day) {
      const start = interval.start + offset * 1440;
      if (start > now && (opensAt == null || start < opensAt)) opensAt = start;
    }
    if (opensAt != null) break;
  }

  return {
    state: 'closed',
    closesIn: null,
    closesAt: null,
    opensAt,
    closingSoon: false,
    arrivalAt: now,
  };
}

/** The status at the moment you would actually arrive. */
export function arrivalStatus(
  hours: string | null | undefined,
  travelMinutes: number,
  now = new Date(),
): ArrivalInfo | null {
  const schedule = parseHours(hours);
  if (!schedule) return null;
  const arrival = istClock(new Date(now.getTime() + travelMinutes * 60_000));
  return arrivalAt(schedule, arrival);
}

/** A compact note for a card, only when the arrival matters. */
export function arrivalNote(info: ArrivalInfo | null): string | null {
  if (!info) return null;
  if (info.state === 'closed') {
    return info.opensAt != null ? `opens ${formatArrivalClock(info.opensAt)}` : 'closed';
  }
  if (info.closingSoon) return `shuts ${formatArrivalClock(info.closesAt)}`;
  return null;
}
