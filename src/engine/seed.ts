export const SEED_MAX_LENGTH = 8;
export const SEED_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

/** Balatro seed rules: uppercase, `0` reads as `O`, only `[A-Z1-9]`, at most 8 chars. */
export function normalizeSeed(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/0/g, 'O')
    .replace(/[^A-Z1-9]/g, '')
    .slice(0, SEED_MAX_LENGTH);
}

export function randomSeed(random: () => number = Math.random, alphabet: string = SEED_ALPHABET): string {
  let seed = '';
  for (let i = 0; i < SEED_MAX_LENGTH; i++) {
    seed += alphabet[Math.floor(random() * alphabet.length)];
  }
  return seed;
}
