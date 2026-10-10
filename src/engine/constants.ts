/** Game constants shared by the analyzer and the UI. Lists mirror TheSoul's index.html. */

export const DECKS = [
  'Red Deck',
  'Blue Deck',
  'Yellow Deck',
  'Green Deck',
  'Black Deck',
  'Magic Deck',
  'Nebula Deck',
  'Ghost Deck',
  'Abandoned Deck',
  'Checkered Deck',
  'Zodiac Deck',
  'Painted Deck',
  'Anaglyph Deck',
  'Plasma Deck',
  'Erratic Deck',
] as const;

export const STAKES = [
  'White Stake',
  'Red Stake',
  'Green Stake',
  'Black Stake',
  'Blue Stake',
  'Purple Stake',
  'Orange Stake',
  'Gold Stake',
] as const;

export const VERSIONS = [
  { value: 10106, label: '1.0.1f' },
  { value: 10103, label: '1.0.1c' },
  { value: 10014, label: '1.0.0n' },
] as const;

/** Second-tier vouchers: locked at run start, unlocked when their base voucher appears. */
export const SECOND_TIER_VOUCHERS = [
  'Overstock Plus',
  'Liquidation',
  'Glow Up',
  'Reroll Glut',
  'Omen Globe',
  'Observatory',
  'Nacho Tong',
  'Recyclomancy',
  'Tarot Tycoon',
  'Planet Tycoon',
  'Money Tree',
  'Antimatter',
  'Illusion',
  'Petroglyph',
  'Retcon',
  'Palette',
] as const;

/** Profile unlocks a player may not have yet (TheSoul's `options`, same order — order matters). */
export const UNLOCK_OPTIONS = [
  'Negative Tag',
  'Foil Tag',
  'Holographic Tag',
  'Polychrome Tag',
  'Rare Tag',
  'Golden Ticket',
  'Mr. Bones',
  'Acrobat',
  'Sock and Buskin',
  'Swashbuckler',
  'Troubadour',
  'Certificate',
  'Smeared Joker',
  'Throwback',
  'Hanging Chad',
  'Rough Gem',
  'Bloodstone',
  'Arrowhead',
  'Onyx Agate',
  'Glass Joker',
  'Showman',
  'Flower Pot',
  'Blueprint',
  'Wee Joker',
  'Merry Andy',
  'Oops! All 6s',
  'The Idol',
  'Seeing Double',
  'Matador',
  'Hit the Road',
  'The Duo',
  'The Trio',
  'The Family',
  'The Order',
  'The Tribe',
  'Stuntman',
  'Invisible Joker',
  'Brainstorm',
  'Satellite',
  'Shoot the Moon',
  "Driver's License",
  'Cartomancer',
  'Astronomer',
  'Burnt Joker',
  'Bootstraps',
  'Overstock Plus',
  'Liquidation',
  'Glow Up',
  'Reroll Glut',
  'Omen Globe',
  'Observatory',
  'Nacho Tong',
  'Recyclomancy',
  'Tarot Tycoon',
  'Planet Tycoon',
  'Money Tree',
  'Antimatter',
  'Illusion',
  'Petroglyph',
  'Retcon',
  'Palette',
] as const;

export const LEGENDARY_JOKERS = ['Canio', 'Triboulet', 'Yorick', 'Chicot', 'Perkeo'] as const;

/** What Balatro's get_current_pool falls back to when a pool is empty (j_joker). */
export const EMPTY_POOL_JOKER = 'Joker';

export const SOUL_CARD = 'The Soul';
