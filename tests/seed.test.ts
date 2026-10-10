import { describe, expect, it } from 'vitest';
import { normalizeSeed, randomSeed } from '../src/engine/seed';

describe('normalizeSeed', () => {
  it.each([
    ['aleeb', 'ALEEB'],
    ['0000', 'OOOO'],
    ['ab-c d_e!', 'ABCDE'],
    ['TOOLONGSEED', 'TOOLONGS'],
    ['  x1y2z3  ', 'X1Y2Z3'],
    ['ÄBC', 'BC'],
    ['', ''],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeSeed(raw)).toBe(expected);
  });

  it('is idempotent', () => {
    expect(normalizeSeed(normalizeSeed('a0b-c9'))).toBe('AOBC9');
  });
});

describe('randomSeed', () => {
  it('produces valid 8-char seeds', () => {
    for (let i = 0; i < 50; i++) {
      const seed = randomSeed();
      expect(seed).toMatch(/^[A-Z1-9]{8}$/);
      expect(normalizeSeed(seed)).toBe(seed);
    }
  });
});
