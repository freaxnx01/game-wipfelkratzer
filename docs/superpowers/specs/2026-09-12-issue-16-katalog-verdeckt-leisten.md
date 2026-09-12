# Spec — Katalog verdeckt Werkzeugleiste und Auswahlleiste (Issue #16)

Repo: `game-wipfelkratzer`. Base: `main`, v0.3.0. Buildless vanilla:
`index.html` + `js/game.js`. three.js r184 via importmap. No build step, no
test framework.

## Problem

`#catalog` (`index.html:54`) is `position: fixed; right: 0; top: 0; bottom: 0;
width: min(320px, 88vw); z-index: 8;` — a full-height right-side drawer. At a
600 px viewport its width is `88vw` = 528 px, wide enough to reach the screen
centre where the bottom-anchored control stack lives:

- `#toolbar` (`index.html:48`) is `bottom: 10px; left: 50%; transform:
  translateX(-50%); max-width: 96vw; flex-wrap: wrap; z-index: 5`.
- `#selbar` (`index.html:71`) is `bottom: calc(var(--toolbar-h, 60px) + 16px);
  left: 50%; transform: translateX(-50%); z-index: 6`, shown (`.on`) whenever
  a placed item is selected.

Both are horizontally centred and, on a 600 px viewport, wide enough that
their right half sits under `#catalog`'s covered region (`x` in `[72, 600]`).
Since `#catalog` spans the full viewport height (`top: 0; bottom: 0`), it sits
above both in stacking order (`z-index: 8` vs. `5`/`6`) and blocks pointer
events across their full height, not just their width — the issue's own
`document.elementFromPoint` check on `#btn-catalog`'s centre confirms this for
the toolbar.

The issue's title only names the toolbar, but the reporter's own comment
widens the scope after re-checking the v0.3.0 verification screenshot
(`t2-selbar-narrow.png`): with an item selected, `#selbar`'s right half — in
particular «Weg damit» (delete) — is equally unreachable while the catalog is
open, because `enterEdit()` (`js/game.js:552`) opens the catalog by default
and `select()` (`js/game.js:570-576`) does not close it, so both panels are
routinely open together.

This is deliberately **not** the #7 overlap. #7 was `#selbar` vs. `#toolbar`
and is fixed by deriving `#selbar`'s offset from `#toolbar`'s real height
(`js/game.js:443-448`, `--toolbar-h`). That fix only relates the two
bottom-stack elements to each other; it says nothing about `#catalog`, which
is a separate, taller, differently-anchored panel that was never part of that
mechanism.

## Goals

- On any viewport width down to 600 px (and narrower, down to `88vw`'s
  practical floor), every `#toolbar` button remains clickable while `#catalog`
  is open.
- Under the same conditions, every `#selbar` button (including «Verschieben»
  / «Drehen» / the wall-move pad / «Weg damit») remains clickable while
  `#catalog` **and** `#selbar` are both open at once.
- The fix generalises: it must not assume a specific button count or a
  specific `#toolbar`/`#selbar` wrap state, because both already reflow
  (`#toolbar` wraps to two rows on narrow viewports, `#selbar`'s wall-pad adds
  width) — the same class of assumption that made #7 need a live-measured
  fix rather than a fixed pixel guess.
- No regression to `#catalog`'s own usability: the item grid keeps scrolling
  (`#catalog-items` already has `overflow-y: auto`), the header and tabs stay
  reachable, and the drawer still opens/closes the same way.

## Non-goals

- `#extras-menu` (`index.html:81`, `bottom: 76px`) and any other floating
  panel are out of scope. The issue and its comment name only toolbar and
  selection bar; extending further is scope creep this spec deliberately
  declines (per the reporter's own note on #7: "war für #7 korrekt ausserhalb
  des Scopes" — the same discipline applies here to panels nobody flagged).
- `#catalog`'s width (`min(320px, 88vw)`) is not changed. The root cause is
  vertical (full-height drawer over a bottom-anchored stack), not horizontal;
  narrowing the drawer would shrink usable catalog space for no benefit once
  the vertical fix is in place (see A2).
- No change to `#editbar` (top-anchored, already clear of `#catalog`'s
  bottom-stack conflict) or to the catalog's tab-switching / wall-highlight
  logic (already correct per the #8 fix).

## Design

Give `#catalog` a `bottom` offset instead of `bottom: 0`, computed live so it
always clears whichever bottom-stack elements are actually visible —
extending the exact mechanism `js/game.js:443-448` already uses for
`#selbar` vs. `#toolbar`, one level up.

- Keep `--toolbar-h` as-is (already tracked by the existing `ResizeObserver`
  on `#toolbar`).
- Add a second `ResizeObserver` on `#selbar`, publishing its live height to a
  new custom property, e.g. `--selbar-h`. A `ResizeObserver` reports `0` for a
  `display: none` element, so when `#selbar` lacks `.on` this naturally
  collapses to `0` with no extra visibility check needed — the same
  self-adjusting property the `#toolbar` observer already relies on.
- Set `#catalog`'s `bottom` via a CSS `calc()` over both properties, with the
  same fallback-constant pattern already used for `--toolbar-h`:
  `bottom: calc(var(--toolbar-h, 60px) + 16px + var(--selbar-h, 0px) + 10px)`.
  The `+ 16px` mirrors `#selbar`'s own existing gap above `#toolbar`
  (`index.html:71`) so the two formulas stay visibly related; the trailing
  `+ 10px` is a small breathing margin between `#selbar`'s top edge and
  `#catalog`'s bottom edge (matching `#toolbar`'s own `bottom: 10px`).
- This is pure CSS/JS wiring, symmetric with the existing #7 fix — no new
  markup, no new dependency, and it degrades safely (falls back to the
  literal `60px`/`0px` constants) before the observers run on first paint.

### Why not shrink `#catalog`'s width instead

`#toolbar` and `#selbar` are horizontally centred and can be wide (two-row
wrap, wall-pad expansion), so no fixed width reduction reliably keeps
`#catalog` clear of them at every breakpoint — the same reasoning that made
#7's fix measure real height rather than guess a constant. A vertical offset
that tracks the actual bottom-stack height is the only approach that doesn't
reintroduce the same class of bug at some other viewport size.

### Interaction with the existing #7 fix

No change to `--toolbar-h` semantics or to `#selbar`'s own `bottom` formula.
The new `--selbar-h` property is additive and only consumed by `#catalog`;
`#selbar` does not need to know its own height, so the existing #7 code path
(`js/game.js:443-448`) is untouched.

## Acceptance Criteria

- At 600×900, with the catalog open and no item selected, every `#toolbar`
  button (`#btn-build`/`#btn-done`/`#btn-catalog`/`#btn-extras`/`#btn-cutaway`/
  `#btn-photo`/`#btn-music`, whichever the current edit mode shows) is
  clickable — verified via `document.elementFromPoint` on each button's centre
  resolving to that button or a descendant of it, not to `#catalog` or
  `#catalog-items`.
- At 600×900, with the catalog open and a placed item selected (so `#selbar`
  also carries `.on`), every visible `#selbar` button (`#btn-move`/`#btn-rot`
  or the wall-pad arrows, plus `#btn-del`) is clickable by the same
  `elementFromPoint` check.
- The same two checks pass at 820×1180 and 1280×800 (the widths already used
  by the #7 verification run), confirming no regression at wider viewports.
- `#catalog-items` still scrolls and every catalog tab still switches
  correctly (no regression to the #8 wall-tab fix).
- Zero uncaught `pageerror` events across the whole scripted run.
- A screenshot at 600×900 with catalog + selection both open shows visible
  daylight between `#catalog`'s bottom edge and `#selbar`'s top edge.

## Assumptions

- **A1** [high] Implemented by adding a `#selbar` `ResizeObserver` mirroring
  the existing `#toolbar` one, publishing `--selbar-h`, and giving `#catalog`
  a live `calc()` bottom offset over both variables.
  Rejected: hand-picking a static extra bottom margin (e.g. always reserve
  120px) — `js/game.js:443-448`'s own comment explains why #7 rejected a
  guessed constant for the toolbar/selbar relationship ("so #selbar never has
  to guess the toolbar's height"); the same argument applies one level up.

- **A2** [med] `#catalog`'s width (`min(320px, 88vw)`, `index.html:54`) is left
  unchanged; the fix is purely a `bottom` offset.
  Rejected: shrinking catalog width at narrow viewports to stop short of the
  toolbar/selbar's horizontal footprint — rejected because `#toolbar`/
  `#selbar` are centred and can be wide (two-row wrap, wall-pad), so no fixed
  width margin is safe at every breakpoint, whereas a full-height drawer that
  stops above the bottom stack is safe regardless of that stack's width.

- **A3** [med] The extra breathing margin between `#selbar`'s top edge and
  `#catalog`'s new bottom edge is a fixed `10px`, not itself observed/derived.
  Rejected: deriving it too (e.g. from `#selbar`'s own margin/padding) — `10px`
  matches `#toolbar`'s existing `bottom: 10px` (`index.html:48`) closely enough
  that it reads as an intentional, consistent gap rather than a magic number,
  and a fixed small constant here carries none of #7's original risk (that
  risk was about *height*, which varies with wrapping; this is a *margin*,
  which does not).

- **A4** [low] `#extras-menu` is explicitly left uncovered by this fix (see
  Non-goals) even though it sits in roughly the same z-index band (`z-index:
  7`, between `#toolbar`'s 5 and `#catalog`'s 8) and could in principle suffer
  a similar overlap.
  Rejected: auditing/fixing `#extras-menu` proactively — neither the issue nor
  its comment names it, and the reporter's own comment explicitly credits #7
  for staying in scope by deferring exactly this kind of adjacent finding.

## Consequences

- `#catalog`'s visible drawer height shrinks somewhat whenever `#selbar` is
  open at a narrow viewport (by roughly `#selbar`'s own height). This is the
  intended trade-off — `#catalog-items` already scrolls, so no content becomes
  unreachable, only the visible window over it gets shorter while a selection
  is active.
- Two live `ResizeObserver`s now run against the bottom UI stack instead of
  one. Negligible cost at this DOM size, but worth knowing if a future issue
  touches `#toolbar`/`#selbar` layout again — the dependency chain is now
  `#toolbar → --toolbar-h → #selbar` and `#toolbar, #selbar → --toolbar-h,
  --selbar-h → #catalog`.
