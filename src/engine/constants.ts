/** Game constants shared by the analyzer and the UI. Lists mirror TheSoul's index.html. */
import type { Blind } from './types';

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

export const BLIND_NAMES: Readonly<Record<Blind, string>> = { small: 'Small Blind', big: 'Big Blind' };

/** Tags that give a pack when their blind is skipped → the pack. */
export const TAG_PACKS: Readonly<Record<string, string>> = {
  'Charm Tag': 'Mega Arcana Pack',
  'Ethereal Tag': 'Spectral Pack',
  'Meteor Tag': 'Mega Celestial Pack',
  'Buffoon Tag': 'Mega Buffoon Pack',
  'Standard Tag': 'Mega Standard Pack',
};

/** Tags whose effect changes later rolls but isn't simulated yet (UI hint on their Skip control). */
export const UNMODELED_TAGS = [
  'Rare Tag',
  'Uncommon Tag',
  'Voucher Tag',
  'Double Tag',
  'Boss Tag',
  'Top-up Tag',
  'Orbital Tag',
  // Change the next shop's joker editions.
  'Foil Tag',
  'Holographic Tag',
  'Polychrome Tag',
  'Negative Tag',
] as const;

/** Vouchers that each add a shop card slot. */
export const SHOP_SLOT_VOUCHERS = ['Overstock', 'Overstock Plus'] as const;
export const BASE_SHOP_SLOTS = 2;

export const LEGENDARY_JOKERS = ['Canio', 'Triboulet', 'Yorick', 'Chicot', 'Perkeo'] as const;

/** What Balatro's get_current_pool falls back to when a pool is empty (j_joker). */
export const EMPTY_POOL_JOKER = 'Joker';

export const SOUL_CARD = 'The Soul';

/** Every Spectral card, incl. the two that also show up in Arcana / Celestial packs (engine SPECTRALS + those two). */
export const SPECTRAL_CARDS = [
  'Familiar',
  'Grim',
  'Incantation',
  'Talisman',
  'Aura',
  'Wraith',
  'Sigil',
  'Ouija',
  'Ectoplasm',
  'Immolate',
  'Ankh',
  'Deja Vu',
  'Hex',
  'Trance',
  'Medium',
  'Cryptid',
  'The Soul',
  'Black Hole',
] as const;
