import type { Edition } from './types';

/** Engine edition strings → our Edition. */
const EDITIONS: Record<string, Edition> = {
  'No Edition': null,
  Foil: 'Foil',
  Holographic: 'Holographic',
  Polychrome: 'Polychrome',
  Negative: 'Negative',
};

export function toEdition(raw: string): Edition {
  return EDITIONS[raw] ?? null;
}
