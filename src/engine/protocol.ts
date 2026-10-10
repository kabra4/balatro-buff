import type { Analysis, Settings } from './types';

export interface AnalyzeRequest {
  id: number;
  settings: Settings;
}

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; id: number; analysis: Analysis }
  | { type: 'error'; id: number | null; message: string };
