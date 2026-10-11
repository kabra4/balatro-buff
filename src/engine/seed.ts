export const SEED_MAX_LENGTH = 8;
export const SEED_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

/** Where a seed can sit in pasted text, tried in order; group 1 is the seed. */
const SEED_PATTERNS: readonly RegExp[] = [
  /[?&]seed=([A-Za-z0-9]{1,8})(?:[&#\s]|$)/i,
  /^([A-Za-z0-9]{1,8})$/,
  /^seed[\s:=#]*([A-Za-z0-9]{1,8})$/i,
];

/** Longer pasted text can't be one of the shapes above (URLs included), so it's skipped outright. */
const MAX_PASTE_LENGTH = 500;

/** Balatro seed rules: uppercase, `0` reads as `O`, only `[A-Z1-9]`, at most 8 chars. */
export function normalizeSeed(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/0/g, 'O')
    .replace(/[^A-Z1-9]/g, '')
    .slice(0, SEED_MAX_LENGTH);
}

/**
 * Seed in pasted text: a `seed=` URL param, a lone word ("N9LXVGLM"), or one labelled "seed"
 * ("Seed: N9LXVGLM"). Anything else (free text, too long, URL-encoded junk) → null.
 */
export function seedFromText(text: string): string | null {
  if (text.length > MAX_PASTE_LENGTH) return null;
  const raw = SEED_PATTERNS.map((pattern) => pattern.exec(text.trim())?.[1]).find((match) => match !== undefined);
  return (raw && normalizeSeed(raw)) || null;
}

export function randomSeed(random: () => number = Math.random, alphabet: string = SEED_ALPHABET): string {
  let seed = '';
  for (let i = 0; i < SEED_MAX_LENGTH; i++) {
    seed += alphabet[Math.floor(random() * alphabet.length)];
  }
  return seed;
}
