/** Search + chip filtering. Chips are data: add one by adding a row to CHIPS. */
import { itemText } from '../engine/format';
import type { Edition, Item } from '../engine/types';
import { soulLabel } from './soulText';

export type LabelKind = 'boss' | 'voucher' | 'tag';

export interface Chip {
  id: string;
  label: string;
  /** Item predicate; omitted when the chip only targets ante labels. */
  item?: (item: Item) => boolean;
  /** Ante header labels this chip selects. */
  labels?: LabelKind[];
}

export const CHIPS: readonly Chip[] = [
  { id: 'jokers', label: 'Jokers', item: (i) => i.kind === 'joker' },
  { id: 'legendary', label: 'Legendary/Soul', item: (i) => isLegendary(i) },
  { id: 'negpoly', label: 'Negative/Poly', item: (i) => hasEdition(i, ['Negative', 'Polychrome']) },
  { id: 'spectral', label: 'Spectral', item: (i) => i.kind === 'spectral' },
  { id: 'vouchers', label: 'Vouchers', labels: ['voucher'] },
  { id: 'tags', label: 'Tags', labels: ['tag'] },
];

export interface Filter {
  query: string;
  chips: string[];
}

export const EMPTY_FILTER: Filter = { query: '', chips: [] };

export function isFilterActive(f: Filter): boolean {
  return f.query.trim() !== '' || f.chips.length > 0;
}

export function matches(item: Item, f: Filter): boolean {
  return matchesQuery(searchText(item), f) && matchesChips(f, (chip) => chip.item?.(item) ?? false);
}

export function matchesLabel(kind: LabelKind, name: string, f: Filter): boolean {
  return matchesQuery(name, f) && matchesChips(f, (chip) => chip.labels?.includes(kind) ?? false);
}

/** Everything a user can read on the card: modifiers, name, and a Soul's legendary. */
export function searchText(item: Item): string {
  const soul = 'soul' in item && item.soul ? ` ${soulLabel(item.soul)}` : '';
  return itemText(item) + soul;
}

function matchesQuery(text: string, f: Filter): boolean {
  const q = f.query.trim().toLowerCase();
  return q === '' || text.toLowerCase().includes(q);
}

function matchesChips(f: Filter, test: (chip: Chip) => boolean): boolean {
  if (f.chips.length === 0) return true;
  return CHIPS.some((chip) => f.chips.includes(chip.id) && test(chip));
}

function isLegendary(item: Item): boolean {
  if (item.kind === 'joker') return item.rarity === 'Legendary';
  return item.kind !== 'playing' && item.soul !== undefined;
}

function hasEdition(item: Item, editions: Edition[]): boolean {
  const edition = item.kind === 'joker' || item.kind === 'playing' ? item.edition : (item.soul?.edition ?? null);
  return edition !== null && editions.includes(edition);
}
