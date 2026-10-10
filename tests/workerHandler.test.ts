import { describe, expect, it } from 'vitest';
import type { ImmolateModule } from '../src/engine/loader';
import type { WorkerResponse } from '../src/engine/protocol';
import type { Settings } from '../src/engine/types';
import { createWorkerHandler } from '../src/engine/workerHandler';
import { DEFAULT_SETTINGS } from '../src/state/settings';

const ENGINE = {} as ImmolateModule;
const req = (id: number, seed = 'ABC') => ({ id, settings: { ...DEFAULT_SETTINGS, seed } });

describe('worker request handler', () => {
  it('retries a failed engine load on the next request', async () => {
    const loads = [Promise.reject(new Error('network down')), Promise.resolve(ENGINE)];
    const { handler, posted } = setup(() => loads.shift()!);

    await handler.preload();
    await handler.handle(req(1));

    expect(posted).toEqual([
      { type: 'error', id: null, message: 'network down' },
      { type: 'ready' },
      { type: 'result', id: 1, analysis: { settings: req(1).settings, antes: [], souls: [] } },
    ]);
  });

  it('reports a per-request load failure without poisoning later requests', async () => {
    const loads = [Promise.reject(new Error('wasm 404')), Promise.resolve(ENGINE)];
    const { handler, posted } = setup(() => loads.shift()!);

    await handler.handle(req(1));
    await handler.handle(req(2));

    expect(posted.map((m) => m.type)).toEqual(['error', 'ready', 'result']);
  });

  it('skips requests superseded while queued', async () => {
    const { handler, posted, ran } = setup(() => Promise.resolve(ENGINE));

    await Promise.all([handler.handle(req(1, 'OLD')), handler.handle(req(2, 'MID')), handler.handle(req(3, 'NEW'))]);

    expect(ran).toEqual(['NEW']);
    expect(posted.filter((m) => m.type === 'skipped')).toEqual([
      { type: 'skipped', id: 1 },
      { type: 'skipped', id: 2 },
    ]);
  });
});

function setup(load: () => Promise<ImmolateModule>) {
  const posted: WorkerResponse[] = [];
  const ran: string[] = [];
  const handler = createWorkerHandler({
    load,
    run: (_engine, settings: Settings) => {
      ran.push(settings.seed);
      return { settings, antes: [], souls: [] };
    },
    post: (m) => posted.push(m),
    yieldToQueue: () => Promise.resolve(),
  });
  return { handler, posted, ran };
}
