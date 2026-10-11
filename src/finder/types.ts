import type { Settings } from '../engine/types';
import { CARDS_PER_ANTE_OPTIONS } from '../state/settings';

export type SlotKind = 'joker' | 'soul' | 'spectral' | 'voucher' | 'tag';
export type Where = 'any' | 'shop' | 'packs';
export type EditionReq = 'any' | 'none' | 'Foil' | 'Holographic' | 'Polychrome' | 'Negative';

export interface Slot {
  id: string;
  kind: SlotKind;
  /** null = Any. soul: the legendary the Soul yields. voucher/tag: required (non-null). */
  item: string | null;
  /** Joker only; 'any' otherwise. */
  edition: EditionReq;
  /** joker/soul/spectral only; voucher/tag ignore it. */
  where: Where;
  /** 1..8 — must appear in an ante <= byAnte. */
  byAnte: number;
  /**
   * null = Any. Only for kinds the shop can yield (others ignore it): a shop occurrence must be
   * within the first `shopSlot` cards of its ante's shop (pack occurrences are unaffected).
   */
  shopSlot: number | null;
}

/** Analyzer settings without the per-seed / display-only fields. */
export type FinderSettings = Omit<Settings, 'seed' | 'maxAnte'>;

export interface FinderQuery {
  settings: FinderSettings;
  slots: Slot[];
}

export const MAX_BY_ANTE = 8;
/** Largest Cards/ante option: no shop has more cards. */
export const MAX_SHOP_SLOT = Math.max(...CARDS_PER_ANTE_OPTIONS);
