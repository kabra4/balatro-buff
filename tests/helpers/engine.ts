import { readFileSync } from 'node:fs';
import { createEngine, type ImmolateModule } from '../../src/engine/loader';

const ENGINE_DIR = new URL('../../public/engine/', import.meta.url);

let cached: Promise<ImmolateModule> | null = null;

/** Real TheSoul wasm engine, loaded from public/engine through the same code path as the app. */
export function loadTestEngine(): Promise<ImmolateModule> {
  cached ??= createEngine(
    readFileSync(new URL('immolate.js', ENGINE_DIR), 'utf8'),
    readFileSync(new URL('immolate.wasm', ENGINE_DIR)),
  );
  return cached;
}
