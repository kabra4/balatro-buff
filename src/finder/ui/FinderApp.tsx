import { useEffect, useRef, useState } from 'preact/hooks';
import { CopyLinkButton } from '../../ui/CopyLinkButton';
import { NavLinks } from '../../ui/NavLinks';
import { SettingsFields, type SelectKey } from '../../ui/SettingsFields';
import { FINDER_SHOP_CAPS } from '../query';
import type { VerifiedHit } from '../searchController';
import { blankSlot, slotProblem } from '../slotKinds';
import type { FinderQuery, FinderSettings, Slot } from '../types';
import { MAX_SLOTS, parseQuery, serializeQuery } from '../url';
import { HistoryList } from './HistoryList';
import { ResultPanel } from './ResultPanel';
import { SearchControls } from './SearchControls';
import { SlotCard } from './SlotCard';
import { useSearch } from './useSearch';

const FINDER_SELECTS: readonly SelectKey[] = ['deck', 'stake', 'version', 'cardsPerAnte'];
const DEFAULT_BY_ANTE = 2;

export function FinderApp() {
  const [query, setQuery] = useState<FinderQuery>(initialQuery);
  const [current, setCurrent] = useState<VerifiedHit | null>(null);
  const [history, setHistory] = useState<VerifiedHit[]>([]);
  const nextId = useRef(query.slots.length + 1);
  const search = useSearch((hit) => {
    setCurrent(hit);
    setHistory((h) => [hit, ...h]);
  });

  useUrlSync(query);
  useResetOnChange(query, search.snapshot.status, search.reset);

  const problems = queryProblems(query);
  const patchSettings = (p: Partial<FinderSettings>) => setQuery((q) => ({ ...q, settings: { ...q.settings, ...p } }));
  const setSlot = (slot: Slot) => setQuery((q) => ({ ...q, slots: q.slots.map((s) => (s.id === slot.id ? slot : s)) }));
  const removeSlot = (id: string) => setQuery((q) => ({ ...q, slots: q.slots.filter((s) => s.id !== id) }));
  const addSlot = () =>
    setQuery((q) => ({ ...q, slots: [...q.slots, blankSlot(`slot-${nextId.current++}`, 'joker', DEFAULT_BY_ANTE)] }));

  return (
    <>
      <header class="topbar finder-topbar">
        <div class="brand">
          <h1>balatro-buff</h1>
          <span class="tagline">Balatro seed finder</span>
          <NavLinks current="finder" />
        </div>
        <div class="settings finder-settings">
          <SettingsFields settings={query.settings} selects={FINDER_SELECTS} onChange={patchSettings} />
          <CopyLinkButton />
        </div>
      </header>
      <main class="content">
        <section class="requirements" aria-label="Requirements">
          <h2 class="section-title">Find a seed with…</h2>
          <p class="section-note">{shopCapsNote(query.settings.cardsPerAnte)}</p>
          <div class="slot-grid">
            {query.slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                settings={query.settings}
                problem={slotProblem(slot, query.settings)}
                onChange={setSlot}
                onRemove={() => removeSlot(slot.id)}
              />
            ))}
            {query.slots.length < MAX_SLOTS && (
              <button type="button" class="slot-add" onClick={addSlot}>
                + Add requirement
              </button>
            )}
          </div>
        </section>
        <SearchControls
          snapshot={search.snapshot}
          problems={problems}
          onSearch={() => search.start(query)}
          onFindNext={search.findNext}
          onStop={search.stop}
        />
        {current && <ResultPanel hit={current} />}
        <HistoryList hits={history} current={current} onSelect={setCurrent} />
      </main>
      <footer class="footer">
        Seeds are drawn at random and checked by the same engine as the analyzer; every match is re-verified with a full
        analysis. Engine &amp; sprites from <a href="https://github.com/SpectralPack/TheSoul">SpectralPack/TheSoul</a> and{' '}
        <a href="https://github.com/MathIsFun0/Immolate">MathIsFun0/Immolate</a>. Balatro assets © LocalThunk / Playstack.
      </footer>
    </>
  );
}

function initialQuery(): FinderQuery {
  const q = parseQuery(window.location.search);
  return q.slots.length > 0 ? q : { ...q, slots: [blankSlot('slot-1', 'soul', DEFAULT_BY_ANTE)] };
}

function queryProblems(query: FinderQuery): string[] {
  if (query.slots.length === 0) return ['Add at least one requirement.'];
  const problems = query.slots.map((s) => slotProblem(s, query.settings)).filter((p): p is string => p !== null);
  return [...new Set(problems)];
}

function useUrlSync(query: FinderQuery): void {
  const search = serializeQuery(query);
  useEffect(() => {
    const { pathname, hash } = window.location;
    window.history.replaceState(null, '', `${pathname}${search ? `?${search}` : ''}${hash}`);
  }, [search]);
}

/** Any edit to the query stops a running/paused search and clears its stats. */
function useResetOnChange(query: FinderQuery, status: string, reset: () => void): void {
  const key = JSON.stringify(query);
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    if (status !== 'idle') reset();
  }, [key]);
}

/** e.g. "Shop: first 10 cards in ante 1, 30 in ante 2, 50 per ante after." */
function shopCapsNote(cardsPerAnte: number): string {
  const capped = Object.entries(FINDER_SHOP_CAPS).map(([ante, cap]) => `${Math.min(cap, cardsPerAnte)} in ante ${ante}`);
  return `Shop: only the first ${capped.join(', ')} count (little money to reroll early), then ${cardsPerAnte} per ante.`;
}
