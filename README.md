# balatro-buff

A Balatro seed analyzer — my own take on [SpectralPack/TheSoul](https://github.com/SpectralPack/TheSoul).
Live at **https://kabra4.github.io/balatro-buff/**.

For any seed it shows, ante by ante: boss blind, voucher, both skip tags, the shop queue and every
booster pack's contents — built on TheSoul's engine, and following your run: vouchers you buy take
effect, and you can skip vouchers, blinds and packs (see [Run choices](#run-choices)).

What it adds on top:

- **The Soul → Legendary.** Every "The Soul" card shows which Legendary joker it gives (and its
  edition). A summary strip at the top lists all Souls in the run in order.
- **Live re-analysis.** No Analyze button — change anything and results update (300 ms debounce).
  The engine runs in a Web Worker, so the page never freezes.
- **Readable output.** Collapsible antes (1–2 open by default) with summary badges
  (★ Souls, ◆ Negatives), sprite cards, search, and filter chips
  (Jokers, Legendary/Soul, Negative/Poly, Spectral, Vouchers, Tags).
- **Simple settings.** One "Cards per ante" dropdown (ante 1 is capped at 15 like the game),
  antes 1–20, Showman toggle, and an Unlocks dialog for profiles that haven't unlocked everything.
- **Shareable.** Settings live in the URL (only non-default values); "Copy link" copies it.
- **Mobile friendly.** Settings collapse into a drawer on narrow screens.

## Usage

Open the page, type a seed (or hit 🎲), pick deck / stake / game version. Results update as you go.

- **Showman** — when on, duplicates are allowed (engine `showman` flag), and Souls don't exclude
  legendaries you already received.
- **Unlocks…** — uncheck items your profile hasn't unlocked yet; they're excluded from the pools.
- URL params: `seed`, `deck`, `stake`, `version` (10106 = 1.0.1f, 10103 = 1.0.1c, 10014 = 1.0.0n),
  `ante`, `cards`, `showman=1`, `locked=Name,Name,…`, `act=…` (run choices, below).

### Run choices

By default the analyzer assumes you buy every voucher, play every blind and open every pack. Each
ante's **Your run** row changes that: untick **Bought** on the voucher, **Skip** a blind (taking its
tag), or untick **Opened** on a shop pack. Later rolls follow:

- **Bought vouchers take effect** — Tarot/Planet Merchant and Tycoon, Magic Trick, Hone, Glow Up
  change the shop; Omen Globe puts Spectral cards into Arcana packs; Hone / Glow Up change Buffoon
  packs; Overstock adds a shop card. A voucher is bought at the first shop of its ante, after the
  cards the shop shows on entry. A voucher you skip can show up again in a later ante.
- **Skipping a blind** opens its tag's pack right away (Charm, Ethereal, Meteor, Buffoon, Standard
  Tag), shown in the ante as e.g. "Charm Tag → Mega Arcana Pack", and costs that blind's shop visit
  (2 fewer shop packs). Packs of the same type share a stream, so the shop's later packs change.
  Tags marked ⚠ (Rare, Uncommon, Voucher, Double, Boss, Top-up, Orbital) have effects that aren't
  simulated yet.
- **"If you skip a blind"** previews (dashed) show the pack a pack tag would give — exactly what
  skipping only that blind would show, Souls included ("if taken").
- **Unopened packs** roll nothing; the next pack of the same type gets their cards.

Choices are seed-specific: changing seed, deck, stake, version, Showman or Unlocks clears them
(**Reset run choices** does too). In the URL they're `act=v1,s2,b2,p2.5` — ante-1 voucher skipped,
ante-2 small and big blinds skipped, ante-2 shop pack 5 not opened.

Output identical to TheSoul is a compatibility mode (no voucher effects, no run choices) used by
the parity tests; with no choices, the analyzer differs from TheSoul from the first effect voucher on.

### How Soul resolution works

Souls are visited in order of appearance (ante ascending; shop, then packs, in queue order). Each one
calls the engine's `nextJoker('sou', ante, false)`; unless Showman is on, the received legendary is
then locked, because you own it and the game won't offer it again. Once all five legendaries are
owned the pool is empty and Balatro falls back to a plain **Joker** — shown as
"Joker (all legendaries owned)", with the edition still rolled. This uses a separate engine
instance, so the shop/pack output is unaffected. It assumes you take every Soul you see.

## Seed finder (`finder.html`)

Describe what you want — jokers (name / edition / shop or packs), Souls (which legendary, edition), spectral
cards, vouchers, tags — each with a "by ante N" deadline, and hit **Search**. Web Workers try random
seeds until one satisfies every requirement (each requirement needs its own card), then pause;
**Find next** continues. Early shops are capped for the finder — only the first 10 shop cards of
ante 1 and 30 of ante 2 count, since there's little money to reroll that early.
Every match is re-checked with a full analysis before it is shown, and
**Open in analyzer** opens it on the analyzer page. The query lives in the URL (`q=` plus the
analyzer's settings params), so searches are shareable.

The finder searches the analyzer's default line: every voucher bought (and in effect), every shop
pack opened, no blind skipped. Pack tags count too: a Charm / Ethereal / Meteor / Buffoon /
Standard Tag's pack is matched as if you skipped that blind. Such a match is re-checked with those
blinds actually skipped (skipping drops that blind's shop visit, so two packs fewer that ante), and
**Open in analyzer** opens the seed with those skips applied. Since voucher effects are now on,
shared finder links may find different seeds than before.

Speed comes from only rolling the engine streams a query needs (e.g. a tag-only query never rolls a
shop) and rejecting a seed as soon as a deadline can't be met — see `src/finder/plan.ts` for which
streams are independent and why. A property test checks the fast path against full analysis on
thousands of random seeds.

## Development

Requires Node 22+.

```sh
npm install
npm run dev        # dev server at http://localhost:5173/balatro-buff/
npm test           # Vitest, runs the real wasm engine in Node
npm run typecheck
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/
npm run bench      # finder throughput: fast path vs full analysis (seeds/s per thread)
```

Layout:

- `public/engine/` — TheSoul's prebuilt `immolate.js` + `immolate.wasm`, unchanged.
- `src/engine/` — engine loader, Web Worker, the analysis port (`analyze.ts`), run choices and
  voucher state (`run.ts`), Soul resolution (`souls.ts`), and the TheSoul text formatter used for
  parity tests.
- `src/state/` — default settings, run-choice tokens (`actions.ts`) and URL (de)serialisation.
- `src/finder/` — seed finder: slot-kind registry (`slotKinds.ts`), matching (`match.ts`), fast-path
  plan + checker (`plan.ts`, `check.ts`), search worker and controller, URL state, UI (`ui/`).
- `src/ui/` — Preact components, CSS sprite tables, filter logic.
- `tests/` — parity against a verbatim port of TheSoul's text loop (compat mode), run choices and
  voucher effects, Soul resolution, URL, filter, seed;
  `tests/finder/` — matching, plan, fast path ≡ full analysis, search loop/controller, finder URL.
- `bench/` — `npm run bench`.

Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml` (Pages source: GitHub Actions).

## Credits

- [SpectralPack/TheSoul](https://github.com/SpectralPack/TheSoul) — the original analyzer; this
  project uses its compiled engine, sprite position tables and sprite sheets.
- [MathIsFun0/Immolate](https://github.com/MathIsFun0/Immolate) — the Balatro RNG engine TheSoul is
  built on.
- Balatro and its art assets (sprite sheets) © LocalThunk / Playstack. This is an unofficial fan tool,
  not affiliated with them.
- m6x11plus font by Daniel Linssen (as shipped with TheSoul).
