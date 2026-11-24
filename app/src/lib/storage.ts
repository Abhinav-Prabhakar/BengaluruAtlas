import type { Theme } from './types';

const SAVED_KEY = 'bengaluru-atlas:saved:v1';
const VISITED_KEY = 'bengaluru-atlas:visited:v1';
const THEME_KEY = 'bengaluru-atlas:theme:v1';

function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Storage can be disabled; the app still works for the session. */
  }
}

function readSet(key: string): Set<string> {
  const raw = readString(key);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

function writeSet(key: string, values: Set<string>): void {
  writeString(key, JSON.stringify([...values]));
}

export function readSaved(): Set<string> {
  return readSet(SAVED_KEY);
}

export function writeSaved(values: Set<string>): void {
  writeSet(SAVED_KEY, values);
}

export function readVisited(): Set<string> {
  return readSet(VISITED_KEY);
}

export function writeVisited(values: Set<string>): void {
  writeSet(VISITED_KEY, values);
}

export function readTheme(): Theme | null {
  const value = readString(THEME_KEY);
  return value === 'light' || value === 'dark' ? value : null;
}

export function writeTheme(theme: Theme): void {
  writeString(THEME_KEY, theme);
}
