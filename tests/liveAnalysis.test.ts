import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupersededError } from '../src/engine/client';
import type { Analysis, Settings } from '../src/engine/types';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { LiveAnalysis } from '../src/ui/liveAnalysis';

const OLD: Settings = { ...DEFAULT_SETTINGS, seed: 'OLD' };
const NEW: Settings = { ...DEFAULT_SETTINGS, seed: 'NEW' };

describe('LiveAnalysis', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces and runs only the latest settings', async () => {
    const { live, runs, results } = setup();

    live.update(OLD);
    live.update(NEW);
    await vi.advanceTimersByTimeAsync(300);
    runs[0]!.resolve();
    await flush();

    expect(runs.map((r) => r.settings.seed)).toEqual(['NEW']);
    expect(results).toEqual(['NEW']);
  });

  it('drops an old-settings result that lands during the debounce of newer settings', async () => {
    const { live, runs, results, busy } = setup();

    live.update(OLD);
    await vi.advanceTimersByTimeAsync(300);
    live.update(NEW); // still inside NEW's 300 ms debounce...
    runs[0]!.resolve(); // ...when OLD's result arrives
    await flush();

    expect(results).toEqual([]);
    expect(busy.at(-1)).toBe(true);

    await vi.advanceTimersByTimeAsync(300);
    runs[1]!.resolve();
    await flush();

    expect(results).toEqual(['NEW']);
    expect(busy.at(-1)).toBe(false);
  });

  it('ignores SupersededError and reports real errors', async () => {
    const { live, runs, errors } = setup();

    live.update(OLD);
    await vi.advanceTimersByTimeAsync(300);
    runs[0]!.reject(new SupersededError());
    await flush();
    live.update(NEW);
    await vi.advanceTimersByTimeAsync(300);
    runs[1]!.reject(new Error('wasm exploded'));
    await flush();

    expect(errors).toEqual(['wasm exploded']);
  });

  it('an empty seed cancels the pending run and clears busy', async () => {
    const { live, runs, busy } = setup();

    live.update(OLD);
    live.update({ ...OLD, seed: '' });
    await vi.advanceTimersByTimeAsync(300);

    expect(runs).toHaveLength(0);
    expect(busy.at(-1)).toBe(false);
  });
});

interface Run {
  settings: Settings;
  resolve: () => void;
  reject: (err: Error) => void;
}

function setup() {
  const runs: Run[] = [];
  const results: string[] = [];
  const errors: string[] = [];
  const busy: boolean[] = [];
  const live = new LiveAnalysis(
    (settings) =>
      new Promise<Analysis>((resolve, reject) => {
        runs.push({ settings, resolve: () => resolve({ settings, antes: [], souls: [] }), reject });
      }),
    {
      onBusy: (b) => busy.push(b),
      onResult: (a) => results.push(a.settings.seed),
      onError: (m) => errors.push(m),
    },
  );
  return { live, runs, results, errors, busy };
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}
