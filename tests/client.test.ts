import { describe, expect, it } from 'vitest';
import { EngineClient, SupersededError, type WorkerLike } from '../src/engine/client';
import type { AnalyzeRequest, WorkerResponse } from '../src/engine/protocol';
import type { Analysis } from '../src/engine/types';
import { DEFAULT_SETTINGS } from '../src/state/settings';

const SETTINGS = { ...DEFAULT_SETTINGS, seed: 'ABC' };

describe('EngineClient', () => {
  it('resolves a request with the worker result', async () => {
    const { client, workers } = setup();

    const pending = client.analyze(SETTINGS);
    const [req] = workers[0]!.sent;
    workers[0]!.reply({ type: 'result', id: req!.id, analysis: analysis() });

    await expect(pending).resolves.toEqual(analysis());
  });

  it('rejects an older request as superseded when a newer one starts', async () => {
    const { client } = setup();

    const first = client.analyze(SETTINGS);
    client.analyze(SETTINGS).catch(() => undefined);

    await expect(first).rejects.toBeInstanceOf(SupersededError);
  });

  it('after a worker crash fails pending requests and uses a fresh worker next time', async () => {
    const { client, workers, errors } = setup();

    const pending = client.analyze(SETTINGS);
    workers[0]!.crash('out of memory');

    await expect(pending).rejects.toThrow('out of memory');
    expect(errors).toEqual(['out of memory']);
    expect(workers[0]!.terminated).toBe(true);

    const retry = client.analyze(SETTINGS);
    expect(workers).toHaveLength(2);
    workers[1]!.reply({ type: 'result', id: workers[1]!.sent[0]!.id, analysis: analysis() });
    await expect(retry).resolves.toEqual(analysis());
  });

  it('maps a worker "skipped" reply to SupersededError', async () => {
    const { client, workers } = setup();

    const pending = client.analyze(SETTINGS);
    workers[0]!.reply({ type: 'skipped', id: workers[0]!.sent[0]!.id });

    await expect(pending).rejects.toBeInstanceOf(SupersededError);
  });

  it('dispose terminates the worker without reporting an error', async () => {
    const { client, workers, errors } = setup();

    const pending = client.analyze(SETTINGS);
    client.dispose();

    await expect(pending).rejects.toBeInstanceOf(SupersededError);
    expect(workers[0]!.terminated).toBe(true);
    expect(errors).toEqual([]);
  });
});

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  sent: AnalyzeRequest[] = [];
  terminated = false;

  postMessage(message: AnalyzeRequest): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(data: WorkerResponse): void {
    this.onmessage?.({ data } as MessageEvent<WorkerResponse>);
  }

  crash(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const errors: string[] = [];
  const client = new EngineClient({ onError: (m) => errors.push(m) }, () => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  });
  return { client, workers, errors };
}

function analysis(): Analysis {
  return { settings: SETTINGS, antes: [], souls: [] };
}
