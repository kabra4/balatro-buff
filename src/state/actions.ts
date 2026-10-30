/**
 * Run choices ⇄ compact URL tokens: `v3` = ante-3 voucher not bought, `s2` / `b2` = ante-2 small /
 * big blind skipped, `p2.5` = ante-2 shop pack 5 (1-based) not opened. Lists are kept canonical:
 * deduped, ordered by ante, then voucher, small, big, packs.
 */
import { packsForAnte } from '../engine/run';
import type { Blind, RunAction } from '../engine/types';
import { MAX_ANTE_LIMIT } from './settings';

const BLIND_CODES: Readonly<Record<Blind, string>> = { small: 's', big: 'b' };

const TOKEN = /^([vsbp])(\d+)(?:\.(\d+))?$/;

export function actionKey(action: RunAction): string {
  if (action.kind === 'skipVoucher') return `v${action.ante}`;
  if (action.kind === 'skipBlind') return `${BLIND_CODES[action.blind]}${action.ante}`;
  return `p${action.ante}.${action.index + 1}`;
}

export function hasAction(actions: readonly RunAction[], action: RunAction): boolean {
  const key = actionKey(action);
  return actions.some((a) => actionKey(a) === key);
}

/** `actions` with `action` removed when present, added otherwise (canonical). */
export function toggleAction(actions: readonly RunAction[], action: RunAction): RunAction[] {
  const key = actionKey(action);
  return hasAction(actions, action) ? actions.filter((a) => actionKey(a) !== key) : canonical([...actions, action]);
}

/** Comma-separated tokens → actions; invalid tokens are dropped. */
export function parseActions(raw: string): RunAction[] {
  return canonical(raw.split(',').flatMap((token) => parseToken(token.trim()) ?? []));
}

export function serializeActions(actions: readonly RunAction[]): string {
  return canonical(actions).map(actionKey).join(',');
}

function canonical(actions: readonly RunAction[]): RunAction[] {
  const byKey = new Map(actions.map((a) => [actionKey(a), a]));
  return [...byKey.values()].sort((x, y) => x.ante - y.ante || rank(x) - rank(y));
}

/** Order within an ante: voucher, small blind, big blind, packs by queue index. */
function rank(action: RunAction): number {
  if (action.kind === 'skipVoucher') return 0;
  if (action.kind === 'skipBlind') return action.blind === 'small' ? 1 : 2;
  return 3 + action.index;
}

function parseToken(token: string): RunAction | null {
  const match = TOKEN.exec(token);
  if (!match) return null;
  const [, code, anteText, packText] = match;
  const ante = Number(anteText);
  if (ante < 1 || ante > MAX_ANTE_LIMIT) return null;
  if (code === 'p') {
    const pack = Number(packText);
    return packText !== undefined && pack >= 1 && pack <= packsForAnte(ante) ? { kind: 'skipPack', ante, index: pack - 1 } : null;
  }
  if (packText !== undefined) return null;
  if (code === 'v') return { kind: 'skipVoucher', ante };
  return { kind: 'skipBlind', ante, blind: code === BLIND_CODES.small ? 'small' : 'big' };
}
