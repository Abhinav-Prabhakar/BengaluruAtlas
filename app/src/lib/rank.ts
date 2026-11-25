/**
 * How the list is ordered.
 *
 * Travel time is the spine, but curation gets a small head start, the hour of
 * the day has a quiet say, and a place that will be shut when you arrive drops
 * well below the open ones. The two minute rounding is deliberate: it stops a
 * one-minute route correction from shuffling the whole list.
 */

import type { Clock } from './hours';
import { timeOfDayAdjustment } from './time';
import type { ResultRow } from './types';

const TIER_BOOST: Record<string, number> = {
  editor: 3,
  wiki: 1.5,
  atlas: 0.5,
};

function tierRank(row: ResultRow): number {
  return row.place.tier === 'editor'
    ? 3
    : row.place.tier === 'wiki'
      ? 2
      : row.place.tier === 'atlas'
        ? 1
        : 0;
}

function scoreBoost(score: number): number {
  if (score >= 70) return 2.5;
  if (score >= 45) return 1.5;
  if (score >= 20) return 0.5;
  return 0;
}

export interface RankOptions {
  raining: boolean;
  /** True in the dry window before sunset. */
  golden?: boolean;
  clock: Clock;
  sunsetMinute?: number | null;
}

export function rankValue(row: ResultRow, options: RankOptions): number {
  let value = Math.round(row.minutes / 2) * 2;
  if (row.place.tier) value -= TIER_BOOST[row.place.tier] ?? 0;
  value -= scoreBoost(row.place.score);
  value += timeOfDayAdjustment(
    row.place,
    options.clock,
    options.sunsetMinute ?? null,
  );

  // A wet afternoon is not the moment to send someone to a lake or a garden.
  if (options.raining && row.place.cat === 'outdoors') value += 7;
  // The dry hour before sunset is the opposite: put the terraces and lakes up.
  if (options.golden && !options.raining) {
    if (row.place.cat === 'outdoors') value -= 4;
    else if (row.place.tags?.includes('outdoor seating')) value -= 2;
  }

  if (row.arrival?.state === 'closed') value += 40;
  else if (row.arrival?.closingSoon) value += 3;

  return value;
}

export function sortRows(rows: ResultRow[], options: RankOptions): ResultRow[] {
  return [...rows].sort(
    (a, b) =>
      rankValue(a, options) - rankValue(b, options) ||
      tierRank(b) - tierRank(a) ||
      b.place.score - a.place.score ||
      a.distanceKm - b.distanceKm ||
      a.place.name.localeCompare(b.place.name),
  );
}
