import type { SoulResult } from '../engine/types';

export const ALL_OWNED_NOTE = 'all legendaries owned';

/** "→ Perkeo (Negative)" / "→ Joker (all legendaries owned)". */
export function soulLabel(soul: SoulResult): string {
  const notes = [soul.edition, soul.allOwned ? ALL_OWNED_NOTE : null].filter((n): n is string => n !== null);
  return `→ ${soul.legendary}${notes.length > 0 ? ` (${notes.join(', ')})` : ''}`;
}
