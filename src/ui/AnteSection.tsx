import type { ComponentChildren } from 'preact';
import { BLIND_NAMES, UNMODELED_TAGS } from '../engine/constants';
import { packTitle } from '../engine/format';
import { BLINDS } from '../engine/run';
import { isSoulCard } from '../engine/souls';
import type { AnteResult, Item, Pack, RunAction } from '../engine/types';
import { hasAction } from '../state/actions';
import { isFilterActive, matches, matchesLabel, type Filter, type LabelKind } from './filter';
import { ItemCard } from './ItemCard';
import { Sprite } from './Sprite';
import { bossLayers, tagLayers, voucherLayers, type Layer } from './sprites';

export interface AnteSectionProps {
  ante: AnteResult;
  filter: Filter;
  open: boolean;
  onToggle: (open: boolean) => void;
  /** The run choices in effect: controls show these right away, before the re-analysis lands. */
  actions: readonly RunAction[];
  onToggleAction: (action: RunAction) => void;
}

const UNMODELED_NOTE = "This tag's effect isn't simulated";

export function AnteSection({ ante, filter, open, onToggle, actions, onToggleAction }: AnteSectionProps) {
  const active = isFilterActive(filter);
  const souls = countItems(ante, isSoulCard);
  const negatives = countItems(ante, (i) => (i.kind === 'joker' || i.kind === 'playing') && i.edition === 'Negative');
  return (
    <details
      id={`ante-${ante.ante}`}
      class="ante"
      open={open}
      onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary class="ante-summary">
        <span class="ante-title">Ante {ante.ante}</span>
        <Label kind="boss" name={ante.boss} layers={bossLayers(ante.boss)} filter={filter} active={active} state={null} />
        <Label
          kind="voucher"
          name={ante.voucher}
          layers={voucherLayers(ante.voucher)}
          filter={filter}
          active={active}
          state={ante.voucherSkipped ? 'skipped' : null}
        />
        {ante.tags.map((tag, i) => (
          <Label
            key={i}
            kind="tag"
            name={tag}
            layers={tagLayers(tag)}
            filter={filter}
            active={active}
            state={ante.skipped?.includes(BLINDS[i]!) ? 'taken' : null}
          />
        ))}
        <span class="ante-badges">
          {souls > 0 && <span class="badge badge-soul" title="The Soul cards">★ {souls}</span>}
          {negatives > 0 && <span class="badge badge-negative" title="Negative cards">◆ {negatives}</span>}
        </span>
      </summary>
      {open && <AnteBody ante={ante} filter={filter} active={active} actions={actions} onToggleAction={onToggleAction} />}
    </details>
  );
}

/** Items (previews included) + header labels in this ante that pass the filter. */
export function countMatches(ante: AnteResult, filter: Filter): number {
  const labels: [LabelKind, string][] = [['boss', ante.boss], ['voucher', ante.voucher], ...ante.tags.map((t): [LabelKind, string] => ['tag', t])];
  const test = (i: Item) => matches(i, filter);
  const previews = (ante.tagPreviews ?? []).reduce((n, p) => n + p.pack.items.filter(test).length, 0);
  return labels.filter(([kind, name]) => matchesLabel(kind, name, filter)).length + countItems(ante, test) + previews;
}

interface AnteBodyProps {
  ante: AnteResult;
  filter: Filter;
  active: boolean;
  actions: readonly RunAction[];
  onToggleAction: (action: RunAction) => void;
}

function AnteBody({ ante, filter, active, actions, onToggleAction }: AnteBodyProps) {
  const visible = (item: Item) => !active || matches(item, filter);
  const shop = ante.shop.map((item, i) => ({ item, n: i + 1 })).filter(({ item }) => visible(item));
  const packs = ante.packs
    .map((pack) => ({ pack, items: pack.items.filter(visible) }))
    .filter(({ items }) => !active || items.length > 0);
  const previews = (ante.tagPreviews ?? [])
    .map(({ blind, pack }) => ({ blind, pack, items: pack.items.filter(visible) }))
    .filter(({ items }) => !active || items.length > 0);
  return (
    <div class="ante-body">
      <RunChoices ante={ante} actions={actions} onToggleAction={onToggleAction} />
      <h3 class="row-title">Shop</h3>
      <div class="card-row">
        {shop.length === 0 ? <p class="empty">No matching shop cards</p> : shop.map(({ item, n }) => <ItemCard key={n} item={item} number={n} />)}
      </div>
      <h3 class="row-title">Packs</h3>
      <div class="packs">
        {packs.length === 0 && <p class="empty">No matching packs</p>}
        {packs.map(({ pack, items }) => {
          const index = pack.queueIndex;
          const skip: RunAction | null = index === undefined ? null : { kind: 'skipPack', ante: ante.ante, index };
          return (
            <PackSection key={pack.tag ? `tag-${pack.tag.blind}` : `pack-${index}`} pack={pack} items={items}>
              {skip && (
                <ToggleButton on={!hasAction(actions, skip)} label="Opened" onClick={() => onToggleAction(skip)} />
              )}
            </PackSection>
          );
        })}
      </div>
      {previews.length > 0 && (
        <>
          <h3 class="row-title">If you skip a blind</h3>
          <div class="packs">
            {previews.map(({ blind, pack, items }) => (
              <PackSection key={blind} pack={pack} items={items} preview />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** "Your run" row: buy or skip the voucher, play or skip each blind (taking its tag). */
function RunChoices({ ante, actions, onToggleAction }: Omit<AnteBodyProps, 'filter' | 'active'>) {
  const voucher: RunAction = { kind: 'skipVoucher', ante: ante.ante };
  return (
    <div class="run-choices" role="group" aria-label={`Your run in ante ${ante.ante}`}>
      <span class="run-title">Your run</span>
      <span class="run-choice">
        Voucher
        <ToggleButton on={!hasAction(actions, voucher)} label="Bought" onClick={() => onToggleAction(voucher)} />
      </span>
      {BLINDS.map((blind, i) => {
        const tag = ante.tags[i]!;
        const skip: RunAction = { kind: 'skipBlind', ante: ante.ante, blind };
        const skipped = hasAction(actions, skip);
        const unmodeled = (UNMODELED_TAGS as readonly string[]).includes(tag);
        return (
          <span key={blind} class="run-choice">
            {BLIND_NAMES[blind]}: {tag}
            <ToggleButton
              on={skipped}
              label={skipped ? 'Skipped' : 'Skip'}
              title={unmodeled ? UNMODELED_NOTE : undefined}
              note={unmodeled ? '⚠' : undefined}
              onClick={() => onToggleAction(skip)}
            />
          </span>
        );
      })}
    </div>
  );
}

interface PackSectionProps {
  pack: Pack;
  items: Item[];
  /** A pack the player would get by skipping a blind (dimmed, its Souls "if taken"). */
  preview?: boolean;
  /** Header controls. */
  children?: ComponentChildren;
}

function PackSection({ pack, items, preview = false, children }: PackSectionProps) {
  return (
    <section class={`pack ${preview ? 'pack-preview' : ''}`}>
      <header class="pack-name">
        <span>{packTitle(pack)}</span>
        <span class="pack-meta">
          choose {pack.choices} of {pack.size}
          {preview && pack.tag && ` · if you skip the ${BLIND_NAMES[pack.tag.blind]}`}
        </span>
        {children}
      </header>
      {pack.unopened ? (
        <p class="empty">not opened</p>
      ) : (
        <div class="card-row">
          {items.map((item, i) => (
            <ItemCard key={i} item={item} preview={preview} />
          ))}
        </div>
      )}
    </section>
  );
}

interface ToggleButtonProps {
  on: boolean;
  label: string;
  onClick: () => void;
  title?: string;
  /** Short marker after the label, e.g. a warning. */
  note?: string;
}

function ToggleButton({ on, label, onClick, title, note }: ToggleButtonProps) {
  return (
    <button type="button" class={`btn-small toggle ${on ? 'toggle-on' : ''}`} aria-pressed={on} title={title} onClick={onClick}>
      {on && '✓ '}
      {label}
      {note && <span class="toggle-note"> {note}</span>}
    </button>
  );
}

interface LabelProps {
  kind: LabelKind;
  name: string;
  layers: Layer[];
  filter: Filter;
  active: boolean;
  /** Voucher not bought / tag taken (its blind skipped). */
  state: 'skipped' | 'taken' | null;
}

function Label({ kind, name, layers, filter, active, state }: LabelProps) {
  const hit = active && matchesLabel(kind, name, filter);
  return (
    <span class={`ante-label label-${kind} ${hit ? 'hit' : ''} ${state ? `label-${state}` : ''}`}>
      <Sprite layers={layers} scale={kind === 'voucher' ? 0.36 : 0.75} label={name} />
      <span class="ante-label-text">{name}</span>
    </span>
  );
}

function countItems(ante: AnteResult, test: (item: Item) => boolean): number {
  let n = ante.shop.filter(test).length;
  for (const pack of ante.packs) n += pack.items.filter(test).length;
  return n;
}
