import type { Analysis, Settings } from './types';

export interface AnalyzeRequest {
  id: number;
  settings: Settings;
}

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; id: number; analysis: Analysis }
  /** A newer request arrived before this one started; it was not analyzed. */
  | { type: 'skipped'; id: number }
  /** `id: null` = engine failed to load outside of any request (it is retried on the next request). */
  | { type: 'error'; id: number | null; message: string };
