import { randomSeed } from '../engine/seed';

/** The characters Balatro itself uses for random seeds (no 0 / O). */
export const FINDER_SEED_ALPHABET = '123456789ABCDEFGHIJKLMNPQRSTUVWXYZ';

export function randomFinderSeed(random: () => number = Math.random): string {
  return randomSeed(random, FINDER_SEED_ALPHABET);
}
