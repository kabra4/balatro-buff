import { describe, expect, it } from 'vitest';
import type { RunAction } from '../src/engine/types';
import { actionKey, hasAction, parseActions, serializeActions, toggleAction } from '../src/state/actions';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { parse, serialize } from '../src/state/url';

const ACTIONS: RunAction[] = [
  { kind: 'skipVoucher', ante: 1 },
  { kind: 'skipBlind', ante: 2, blind: 'small' },
  { kind: 'skipBlind', ante: 2, blind: 'big' },
  { kind: 'skipPack', ante: 2, index: 4 },
  { kind: 'skipVoucher', ante: 20 },
];

describe('run choices in the URL', () => {
  it('writes compact tokens under act and round-trips them', () => {
    const query = serialize({ ...DEFAULT_SETTINGS, seed: 'ABC', actions: ACTIONS });

    expect(query).toBe('seed=ABC&act=v1,s2,b2,p2.5,v20');
    expect(parse(query).actions).toEqual(ACTIONS);
  });

  it('omits act when there are no actions', () => {
    expect(serialize({ ...DEFAULT_SETTINGS, actions: [] })).toBe('');
    expect(serialize({ ...DEFAULT_SETTINGS, actions: undefined })).toBe('');
    expect(parse('act=').actions).toEqual([]);
  });

  it('drops invalid tokens, dedupes, and keeps canonical order', () => {
    const tokens = ['p2.5', 'v0', 'v21', 's', 'x3', 'p1.5', 'p2.0', 'p2.7', 's2.1', 'v2.', 'b2', ' s2 ', 'v1', 'b2', 'v-1', 'V3'];

    expect(serializeActions(parseActions(tokens.join(',')))).toBe('v1,s2,b2,p2.5');
    expect(parse('act=%3Cscript%3E,p1.4').actions).toEqual([{ kind: 'skipPack', ante: 1, index: 3 }]);
  });

  it('toggles an action on and off', () => {
    const on = toggleAction([{ kind: 'skipBlind', ante: 3, blind: 'big' }], { kind: 'skipVoucher', ante: 3 });

    expect(on.map(actionKey)).toEqual(['v3', 'b3']);
    expect(hasAction(on, { kind: 'skipVoucher', ante: 3 })).toBe(true);
    expect(toggleAction(on, { kind: 'skipVoucher', ante: 3 }).map(actionKey)).toEqual(['b3']);
  });
});
