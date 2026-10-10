/** Diverse finder queries for the fast-path ≡ full-analysis gate (and benchmarks). */
import type { EditionReq, FinderQuery, FinderSettings, Slot, SlotKind, Where } from '../../src/finder/types';

export const BASE_SETTINGS: FinderSettings = {
  deck: 'Red Deck',
  stake: 'White Stake',
  version: 10106,
  cardsPerAnte: 15,
  showman: false,
  locked: [],
};

let nextId = 1;

export function slot(kind: SlotKind, item: string | null, byAnte: number, opts: { edition?: EditionReq; where?: Where } = {}): Slot {
  return { id: `s${nextId++}`, kind, item, byAnte, edition: opts.edition ?? 'any', where: opts.where ?? 'any' };
}

export function query(settings: Partial<FinderSettings>, slots: Slot[]): FinderQuery {
  return { settings: { ...BASE_SETTINGS, ...settings }, slots };
}

export const QUERIES: Record<string, FinderQuery> = {
  'tags only (one locked in ante 1)': query({}, [slot('tag', 'Charm Tag', 4), slot('tag', 'Buffoon Tag', 4)]),
  'voucher chain + tag, Nebula, locked unlocks': query({ deck: 'Nebula Deck', locked: ['Observatory', 'Negative Tag'] }, [
    slot('voucher', 'Hone', 4),
    slot('voucher', 'Glow Up', 8),
    slot('tag', 'Investment Tag', 8),
  ]),
  'soul + Black Hole, Ghost Deck, 1.0.1c, showman': query({ deck: 'Ghost Deck', version: 10103, showman: true }, [
    slot('soul', null, 8),
    slot('spectral', 'Black Hole', 8),
  ]),
  'joker editions shop/any, Zodiac, Gold Stake': query({ deck: 'Zodiac Deck', stake: 'Gold Stake', cardsPerAnte: 25 }, [
    slot('joker', null, 5, { edition: 'Polychrome' }),
    slot('joker', null, 2, { edition: 'Holographic', where: 'shop' }),
    slot('joker', 'Joker', 3, { edition: 'none' }),
  ]),
  'Ghost Deck spectrals shop + packs, Orange Stake': query({ deck: 'Ghost Deck', stake: 'Orange Stake' }, [
    slot('spectral', null, 1, { where: 'shop' }),
    slot('spectral', 'Familiar', 3, { where: 'packs' }),
    slot('spectral', null, 2),
  ]),
  'buffoon packs + plain Joker, 1.0.0n, Gold Stake, locked': query(
    { version: 10014, stake: 'Gold Stake', locked: ['Blueprint', 'Negative Tag', 'Overstock Plus', 'Showman'] },
    [slot('joker', null, 2, { where: 'packs' }), slot('joker', 'Joker', 3), slot('voucher', 'Overstock', 2)],
  ),
  'two souls + negative joker overlap': query({ cardsPerAnte: 10 }, [
    slot('soul', null, 8),
    slot('soul', null, 8),
    slot('joker', null, 8, { edition: 'Negative' }),
  ]),
  'showman Magic Deck, locked items, mixed kinds': query({ deck: 'Magic Deck', showman: true, locked: ['Negative Tag', 'Blueprint'] }, [
    slot('joker', null, 1, { where: 'shop' }),
    slot('spectral', null, 4),
    slot('tag', 'Negative Tag', 2),
    slot('joker', 'Blueprint', 4),
  ]),
  'deep shop: Blueprint by 8, 50 cards, Black Stake': query({ stake: 'Black Stake', cardsPerAnte: 50, deck: 'Plasma Deck' }, [
    slot('joker', 'Blueprint', 8),
    slot('soul', 'Perkeo', 8, { where: 'packs' }),
  ]),
};
