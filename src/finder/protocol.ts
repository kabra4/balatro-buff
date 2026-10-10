import type { FinderQuery } from './types';

export type FinderWorkerRequest =
  | { type: 'start'; query: FinderQuery }
  | { type: 'pause' }
  | { type: 'resume' };

export type FinderWorkerResponse =
  | { type: 'ready' }
  /** Seeds checked since the previous progress message. */
  | { type: 'progress'; checked: number }
  /** Fast-path match. The worker pauses itself right after posting it. */
  | { type: 'hit'; seed: string }
  /** Engine load or checker failure; the search in this worker is stopped. */
  | { type: 'error'; message: string };
