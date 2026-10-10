import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEngine } from '../src/engine/loader';

const PUBLIC = new URL('../public/', import.meta.url);

describe('loadEngine', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forgets a failed load so the next call retries, then memoizes success', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      calls++;
      if (calls <= 2) throw new TypeError('Failed to fetch');
      const bytes = readFileSync(new URL(url.replace('http://test/', ''), PUBLIC));
      return new Response(bytes);
    });

    await expect(loadEngine('http://test/')).rejects.toThrow('Failed to fetch');
    const engine = await loadEngine('http://test/');
    const again = await loadEngine('http://test/');

    expect(typeof engine.Instance).toBe('function');
    expect(again).toBe(engine);
    expect(calls).toBe(4);
  });
});
