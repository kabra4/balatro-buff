/**
 * Finder query ⇄ query string. Settings reuse the analyzer's params (only non-default values);
 * slots go in one compact, versioned param:
 *   q=1*joker_Blueprint_Negative_shop_3*tag_Charm+Tag___2
 * (version, then per slot `kind_item_edition_where_byAnte`; empty = any). Anything invalid is
 * dropped or defaulted — never trusted.
 */
import { DEFAULT_SETTINGS } from '../state/settings';
import { parse as parseSettings, serialize as serializeSettings } from '../state/url';
import { SLOT_KIND_IDS, SLOT_KINDS } from './slotKinds';
import { MAX_BY_ANTE, type EditionReq, type FinderQuery, type FinderSettings, type Slot, type SlotKind, type Where } from './types';

export const SLOTS_PARAM = 'q';
export const SLOTS_FORMAT_VERSION = '1';
export const MAX_SLOTS = 12;

const MAX_SLOTS_PARAM_LENGTH = 2000;
const SLOT_SEPARATOR = '*';
const FIELD_SEPARATOR = '_';
const EDITIONS: readonly EditionReq[] = ['any', 'none', 'Foil', 'Holographic', 'Polychrome', 'Negative'];
const WHERES: readonly Where[] = ['any', 'shop', 'packs'];

export function serializeQuery(query: FinderQuery): string {
  const settings = serializeSettings({ ...DEFAULT_SETTINGS, ...query.settings });
  const slots = [SLOTS_FORMAT_VERSION, ...query.slots.map(encodeSlot)].join(SLOT_SEPARATOR);
  const params = new URLSearchParams(settings);
  if (query.slots.length > 0) params.set(SLOTS_PARAM, slots);
  return params.toString().replace(/%2C/g, ',');
}

/** Slot ids are assigned as `slot-1`, `slot-2`, … in order. */
export function parseQuery(search: string): FinderQuery {
  const { seed: _seed, maxAnte: _maxAnte, ...settings } = parseSettings(search);
  return { settings: settings satisfies FinderSettings, slots: parseSlots(new URLSearchParams(search).get(SLOTS_PARAM)) };
}

function encodeSlot(slot: Slot): string {
  return [slot.kind, slot.item ?? '', anyAsEmpty(slot.edition), anyAsEmpty(slot.where), String(slot.byAnte)].join(FIELD_SEPARATOR);
}

function parseSlots(raw: string | null): Slot[] {
  if (raw === null || raw.length > MAX_SLOTS_PARAM_LENGTH) return [];
  const [version, ...parts] = raw.split(SLOT_SEPARATOR);
  if (version !== SLOTS_FORMAT_VERSION) return [];
  return parts
    .map(decodeSlot)
    .filter((s): s is Omit<Slot, 'id'> => s !== null)
    .slice(0, MAX_SLOTS)
    .map((s, i) => ({ id: `slot-${i + 1}`, ...s }));
}

function decodeSlot(part: string): Omit<Slot, 'id'> | null {
  const fields = part.split(FIELD_SEPARATOR);
  if (fields.length !== 5) return null;
  const [kindRaw = '', itemRaw = '', editionRaw = '', whereRaw = '', anteRaw = ''] = fields;
  if (!(SLOT_KIND_IDS as string[]).includes(kindRaw)) return null;
  const kind = kindRaw as SlotKind;
  const spec = SLOT_KINDS[kind];
  if (itemRaw !== '' && !spec.itemOptions.includes(itemRaw)) return null;
  return {
    kind,
    item: itemRaw === '' ? null : itemRaw,
    edition: spec.hasEdition ? oneOf(EDITIONS, editionRaw) : 'any',
    where: spec.hasWhere ? oneOf(WHERES, whereRaw) : 'any',
    byAnte: byAnte(anteRaw),
  };
}

function oneOf<T extends string>(values: readonly T[], raw: string): T {
  return values.find((v) => v === raw) ?? (values[0] as T);
}

function byAnte(raw: string): number {
  const n = /^\d{1,2}$/.test(raw) ? Number(raw) : MAX_BY_ANTE;
  return Math.min(MAX_BY_ANTE, Math.max(1, n));
}

function anyAsEmpty(value: string): string {
  return value === 'any' ? '' : value;
}
