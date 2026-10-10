import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { randomSeed } from './engine/seed';
import type { AnteResult, Settings } from './engine/types';
import { parse, serialize } from './state/url';
import { AnteSection, countMatches } from './ui/AnteSection';
import { EMPTY_FILTER, isFilterActive, type Filter } from './ui/filter';
import { FilterBar } from './ui/FilterBar';
import { SettingsBar } from './ui/SettingsBar';
import { SoulSummary } from './ui/SoulSummary';
import { useAnalysis } from './ui/useAnalysis';

const DEFAULT_OPEN_ANTES = [1, 2];

export function App() {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const { analysis, status, error } = useAnalysis(settings);
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [open, setOpen] = useState<Set<number>>(() => new Set(DEFAULT_OPEN_ANTES));

  useUrlSync(settings);
  useFilterCollapse(analysis?.antes, filter, setOpen);

  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));
  const setAnteOpen = (ante: number, isOpen: boolean) =>
    setOpen((prev) => {
      if (prev.has(ante) === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(ante);
      else next.delete(ante);
      return next;
    });
  const jumpTo = (ante: number) => {
    setAnteOpen(ante, true);
    requestAnimationFrame(() => document.getElementById(`ante-${ante}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <>
      <header class="topbar">
        <div class="brand">
          <h1>balatro-buff</h1>
          <span class="tagline">Balatro seed analyzer</span>
        </div>
        <SettingsBar settings={settings} status={status} onChange={patch} />
      </header>
      <main class="content">
        {error && <p class="error">Engine error: {error}</p>}
        {!settings.seed && <p class="empty">Enter a seed or roll a random one to analyze.</p>}
        {analysis && settings.seed && (
          <>
            <SoulSummary souls={analysis.souls} maxAnte={analysis.settings.maxAnte} onJump={jumpTo} />
            <FilterBar
              filter={filter}
              onChange={setFilter}
              onExpandAll={() => setOpen(new Set(analysis.antes.map((a) => a.ante)))}
              onCollapseAll={() => setOpen(new Set())}
            />
            <div class="antes">
              {analysis.antes.map((ante) => (
                <AnteSection
                  key={ante.ante}
                  ante={ante}
                  filter={filter}
                  open={open.has(ante.ante)}
                  onToggle={(isOpen) => setAnteOpen(ante.ante, isOpen)}
                />
              ))}
            </div>
          </>
        )}
      </main>
      <footer class="footer">
        Engine &amp; sprites from{' '}
        <a href="https://github.com/SpectralPack/TheSoul">SpectralPack/TheSoul</a> and{' '}
        <a href="https://github.com/MathIsFun0/Immolate">MathIsFun0/Immolate</a>. Balatro assets © LocalThunk / Playstack.
      </footer>
    </>
  );
}

function initialSettings(): Settings {
  const s = parse(window.location.search);
  return s.seed ? s : { ...s, seed: randomSeed() };
}

function useUrlSync(settings: Settings): void {
  const query = serialize(settings);
  useEffect(() => {
    const { pathname, hash } = window.location;
    window.history.replaceState(null, '', `${pathname}${query ? `?${query}` : ''}${hash}`);
  }, [query]);
}

/** With an active filter only antes with matches are open; clearing the filter restores the default. */
function useFilterCollapse(
  antes: AnteResult[] | undefined,
  filter: Filter,
  setOpen: (open: Set<number>) => void,
): void {
  const active = isFilterActive(filter);
  const wasActive = useRef(false);
  const matching = useMemo(
    () => (active && antes ? antes.filter((a) => countMatches(a, filter) > 0).map((a) => a.ante) : []),
    [antes, filter, active],
  );
  const key = matching.join(',');
  useEffect(() => {
    if (active) setOpen(new Set(matching));
    else if (wasActive.current) setOpen(new Set(DEFAULT_OPEN_ANTES));
    wasActive.current = active;
  }, [active, key]);
}
