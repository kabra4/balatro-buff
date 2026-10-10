/** Settings ⇄ query string. Only non-default values are written; invalid values parse to defaults. */
import { DECKS, STAKES, UNLOCK_OPTIONS, VERSIONS } from '../engine/constants';
import { normalizeSeed } from '../engine/seed';
import type { Settings } from '../engine/types';
import { CARDS_PER_ANTE_OPTIONS, DEFAULT_SETTINGS, MAX_ANTE_LIMIT } from './settings';

interface Param<K extends keyof Settings> {
  field: K;
  key: string;
  encode: (value: Settings[K]) => string;
  decode: (raw: string) => Settings[K] | undefined;
}

const PARAMS: Param<keyof Settings>[] = [
  param({ field: 'seed', key: 'seed', encode: String, decode: (r) => normalizeSeed(r) || undefined }),
  param({ field: 'deck', key: 'deck', encode: String, decode: oneOf(DECKS) }),
  param({ field: 'stake', key: 'stake', encode: String, decode: oneOf(STAKES) }),
  param({
    field: 'version',
    key: 'version',
    encode: String,
    decode: numberOneOf(VERSIONS.map((v) => v.value)),
  }),
  param({ field: 'maxAnte', key: 'ante', encode: String, decode: clampedInt(1, MAX_ANTE_LIMIT) }),
  param({ field: 'cardsPerAnte', key: 'cards', encode: String, decode: numberOneOf(CARDS_PER_ANTE_OPTIONS) }),
  param({ field: 'showman', key: 'showman', encode: (v) => (v ? '1' : '0'), decode: (r) => r === '1' || r === 'true' }),
  param({ field: 'locked', key: 'locked', encode: (v) => v.join(','), decode: (r) => orderedUnlocks(r.split(',')) }),
];

export function serialize(s: Settings): string {
  const params = new URLSearchParams();
  for (const p of PARAMS) {
    const value = p.encode(s[p.field]);
    if (value !== p.encode(DEFAULT_SETTINGS[p.field])) params.set(p.key, value);
  }
  return params.toString().replace(/%2C/g, ',');
}

export function parse(query: string): Settings {
  const params = new URLSearchParams(query);
  const settings: Settings = { ...DEFAULT_SETTINGS, locked: [...DEFAULT_SETTINGS.locked] };
  for (const p of PARAMS) {
    const raw = params.get(p.key);
    const value = raw === null ? undefined : p.decode(raw);
    if (value !== undefined) assign(settings, p.field, value);
  }
  return settings;
}

/** Locked names filtered to known Unlocks, deduped, in canonical (TheSoul options) order. */
export function orderedUnlocks(names: Iterable<string>): string[] {
  const wanted = new Set(Array.from(names, (n) => n.trim()));
  return UNLOCK_OPTIONS.filter((o) => wanted.has(o));
}

function param<K extends keyof Settings>(p: Param<K>): Param<keyof Settings> {
  return p as unknown as Param<keyof Settings>;
}

function assign<K extends keyof Settings>(s: Settings, field: K, value: Settings[K]): void {
  s[field] = value;
}

function oneOf(values: readonly string[]): (raw: string) => string | undefined {
  return (raw) => (values.includes(raw) ? raw : undefined);
}

function numberOneOf(values: readonly number[]): (raw: string) => number | undefined {
  return (raw) => (values.includes(Number(raw)) ? Number(raw) : undefined);
}

function clampedInt(min: number, max: number): (raw: string) => number | undefined {
  return (raw) => {
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? undefined : Math.min(max, Math.max(min, n));
  };
}
