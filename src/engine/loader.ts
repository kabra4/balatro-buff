/**
 * Loads TheSoul's prebuilt emscripten engine (`public/engine/immolate.{js,wasm}`).
 *
 * `immolate.js` is a non-modularized emscripten build: it reads a global-ish `Immolate`
 * config object and populates it with the embind API. We evaluate its source inside a
 * function scope where `Immolate` is a parameter and every environment probe emscripten
 * uses (`process`, `require`, `window`, `importScripts`, ...) is shadowed to `undefined`.
 * The wasm bytes are handed over via `wasmBinary`, so emscripten never fetches anything
 * itself. Result: one identical code path in a module worker, the main thread and Node (tests).
 */

export interface EmHandle {
  delete(): void;
}

export interface EmVector<T> extends EmHandle {
  size(): number;
  get(index: number): T;
}

export interface JokerStickersHandle extends EmHandle {
  eternal: boolean;
  perishable: boolean;
  rental: boolean;
}

export interface JokerDataHandle extends EmHandle {
  joker: string;
  rarity: string;
  edition: string;
  /** Each read returns a fresh copy that must be deleted. */
  readonly stickers: JokerStickersHandle;
}

export interface ShopItemHandle extends EmHandle {
  type: string;
  item: string;
  /** Each read returns a fresh copy that must be deleted. */
  readonly jokerData: JokerDataHandle;
}

export interface CardHandle extends EmHandle {
  base: string;
  enhancement: string;
  edition: string;
  seal: string;
}

export interface PackInfoHandle extends EmHandle {
  type: string;
  size: number;
  choices: number;
}

export interface InstParamsHandle extends EmHandle {
  deck: string;
  stake: string;
  showman: boolean;
  version: number;
}

export interface EngineInstance extends EmHandle {
  params: InstParamsHandle;
  lock(item: string): void;
  unlock(item: string): void;
  isLocked(item: string): boolean;
  initLocks(ante: number, freshProfile: boolean, freshRun: boolean): void;
  initUnlocks(ante: number, freshProfile: boolean): void;
  setStake(stake: string): void;
  setDeck(deck: string): void;
  nextBoss(ante: number): string;
  nextVoucher(ante: number): string;
  nextTag(ante: number): string;
  nextShopItem(ante: number): ShopItemHandle;
  nextPack(ante: number): string;
  nextArcanaPack(size: number, ante: number): EmVector<string>;
  nextCelestialPack(size: number, ante: number): EmVector<string>;
  nextSpectralPack(size: number, ante: number): EmVector<string>;
  nextBuffoonPack(size: number, ante: number): EmVector<JokerDataHandle>;
  nextStandardPack(size: number, ante: number): EmVector<CardHandle>;
  nextJoker(source: string, ante: number, hasStickers: boolean): JokerDataHandle;
}

export interface ImmolateModule {
  Instance: new (seed: string) => EngineInstance;
  InstParams: new (deck: string, stake: string, showman: boolean, version: number) => InstParamsHandle;
  packInfo(pack: string): PackInfoHandle;
  VOUCHERS: EmVector<string>;
  LEGENDARY_JOKERS: EmVector<string>;
}

const SHADOWED_GLOBALS = ['process', 'require', 'module', 'window', 'document', 'importScripts'] as const;

let cached: Promise<ImmolateModule> | null = null;

/** Fetches `<baseUrl>engine/immolate.{js,wasm}` and instantiates the engine. Memoized. */
export function loadEngine(baseUrl: string): Promise<ImmolateModule> {
  cached ??= fetchEngine(baseUrl).catch((err: unknown) => {
    cached = null;
    throw err;
  });
  return cached;
}

/** Instantiates the engine from the raw `immolate.js` source and `immolate.wasm` bytes. */
export function createEngine(source: string, wasmBinary: ArrayBuffer | Uint8Array): Promise<ImmolateModule> {
  return new Promise((resolve, reject) => {
    const config: Record<string, unknown> = {
      wasmBinary,
      noInitialRun: true,
      onAbort: (what: unknown) => reject(new Error(`Immolate aborted: ${String(what)}`)),
    };
    config.onRuntimeInitialized = () => resolve(config as unknown as ImmolateModule);
    try {
      const run = new Function('Immolate', ...SHADOWED_GLOBALS, source) as (cfg: unknown) => void;
      run(config);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

async function fetchEngine(baseUrl: string): Promise<ImmolateModule> {
  const [source, wasm] = await Promise.all([
    fetchOk(`${baseUrl}engine/immolate.js`).then((r) => r.text()),
    fetchOk(`${baseUrl}engine/immolate.wasm`).then((r) => r.arrayBuffer()),
  ]);
  return createEngine(source, wasm);
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res;
}
