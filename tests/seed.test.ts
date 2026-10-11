import { describe, expect, it } from 'vitest';
import { normalizeSeed, randomSeed, seedFromText } from '../src/engine/seed';

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

describe('seedFromText', () => {
  it.each([
    ['N9LXVGLM', 'N9LXVGLM'],
    ['  n9lxvglm\n', 'N9LXVGLM'],
    ['Seed: ABCD1234', 'ABCD1234'],
    ['seed 0OPS', 'OOPS'],
    ['https://kabra4.github.io/balatro-buff/?seed=K2PQ81ZA&deck=Ghost+Deck', 'K2PQ81ZA'],
    ['https://spectralpack.github.io/TheSoul/?deck=Red+Deck&seed=ALEEB', 'ALEEB'],
  ])('%j → %s', (text, expected) => {
    expect(seedFromText(text)).toBe(expected);
  });

  it.each([[''], ['   '], ['TOOLONGSEEDTEXT'], ['!!!'], ['https://example.com/?seed='], ['hello world!!'], ['my seed is great'], ['Seed: TOOLONGSEED'], ['?seed=TOOLONGSEEDTEXT'], ['?seed=AB%20C']])('%j → null', (text) => {
    expect(seedFromText(text)).toBeNull();
  });

  it('stays fast on huge whitespace-padded text', () => {
    const start = performance.now();
    expect(seedFromText(`seed${' '.repeat(80_000)}!`)).toBeNull();
    expect(seedFromText(`seed${' '.repeat(400)}!`)).toBeNull();
    expect(performance.now() - start).toBeLessThan(50);
  });
});
